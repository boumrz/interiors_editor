"""Durable Telegram support conversations and delivery queue."""

import json
import re
import secrets
import sqlite3
import time


EDITOR_URL = "https://t.me/InteriorsEditorBot?startapp"
POLICY_URL = "https://domiknote.ru/legal/2026-11-24.2/telegram-support-privacy.html"
DRAFT_LIFETIME = 24 * 60 * 60
PHOTO_WINDOW = 15 * 60
TICKET_LIFETIME = 30 * 24 * 60 * 60
REPLAY_LIFETIME = 2 * DRAFT_LIFETIME
MAX_PHOTOS = 5
MAX_TEXT = 3000

SCHEMA = """
CREATE TABLE IF NOT EXISTS seen (
    update_id INTEGER PRIMARY KEY,
    received_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS drafts (
    chat_id INTEGER PRIMARY KEY,
    token TEXT NOT NULL,
    description TEXT NOT NULL,
    photos TEXT NOT NULL,
    touched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
    number TEXT PRIMARY KEY,
    author INTEGER NOT NULL,
    touched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS direct_support (
    chat_id INTEGER PRIMARY KEY,
    intro_job INTEGER,
    ticket TEXT REFERENCES tickets(number) ON DELETE CASCADE,
    photo_count INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS owner_messages (
    message_id INTEGER PRIMARY KEY,
    ticket TEXT NOT NULL REFERENCES tickets(number) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method TEXT NOT NULL,
    payload TEXT NOT NULL,
    purpose TEXT NOT NULL,
    ticket TEXT REFERENCES tickets(number) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'queued',
    code TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    ready_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS outbox_ready ON outbox(state, ready_at, id);
"""


class DeliveryError(Exception):
    """Classifies a Telegram delivery outcome without retaining remote details."""

    def __init__(self, kind, *, delay=0, code="telegram_error"):
        if kind not in ("retry", "rejected", "unknown"):
            raise ValueError("Unrecognized delivery outcome")
        self.kind = kind
        self.delay = delay
        self.code = code if isinstance(code, str) and re.fullmatch(r"[a-z0-9_-]{1,48}", code) else "telegram_error"
        super().__init__(self.code)


def _object(value):
    return value if isinstance(value, dict) else {}


def _positive(value):
    return type(value) is int and 0 < value < 2**63


def _private_chat(message, actor):
    chat = _object(message.get("chat"))
    chat_id = chat.get("id")
    return chat_id if (
        chat.get("type") == "private" and _positive(chat_id)
        and _positive(actor.get("id")) and actor["id"] == chat_id
        and actor.get("is_bot") is False
    ) else None


def _editor_keyboard(include_support=False):
    rows = [[{"text": "Открыть редактор", "url": EDITOR_URL}]]
    if include_support:
        rows.append([{"text": "Написать в поддержку", "url": "https://t.me/InteriorsEditorBot?start=support"}])
    return {"inline_keyboard": rows}


def _draft_keyboard(token):
    return {"inline_keyboard": [[
        {"text": "Отправить", "callback_data": f"support:send:{token}"},
        {"text": "Отмена", "callback_data": f"support:cancel:{token}"},
    ]]}


def _largest_photo(value):
    if not isinstance(value, list):
        return None
    choices = []
    for index, item in enumerate(value):
        photo = _object(item)
        file_id = photo.get("file_id")
        width, height = photo.get("width"), photo.get("height")
        if isinstance(file_id, str) and 0 < len(file_id) <= 512:
            area = width * height if _positive(width) and _positive(height) else 0
            choices.append((area, index, file_id))
    return max(choices, default=(0, 0, None))[2]


class Support:
    """Handles updates and reconciles delivery under the service's singleton lock."""

    def __init__(self, db_path, owner_id, *, clock=time.time, bot_started_at=None, recover_inflight=True):
        if not _positive(owner_id):
            raise ValueError("Invalid owner identity")
        self.owner_id = owner_id
        self.clock = clock
        self.bot_started_at = bot_started_at
        self.db = sqlite3.connect(db_path)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.execute("PRAGMA journal_mode = WAL")
        self.db.execute("PRAGMA synchronous = FULL")
        self.db.executescript(SCHEMA)
        if recover_inflight:
            with self.db:
                self.db.execute("""
                    UPDATE outbox SET state = 'uncertain', code = 'interrupted'
                    WHERE state = 'sending'
                """)

    def close(self):
        self.db.close()

    def _time(self):
        return int(self.clock())

    def _expire(self, now):
        self.db.execute("DELETE FROM seen WHERE received_at <= ?", (now - REPLAY_LIFETIME,))
        self.db.execute("DELETE FROM drafts WHERE touched_at <= ?", (now - DRAFT_LIFETIME,))
        self.db.execute("DELETE FROM direct_support WHERE expires_at <= ?", (now,))
        self.db.execute("DELETE FROM tickets WHERE touched_at <= ?", (now - TICKET_LIFETIME,))
        self.db.execute("DELETE FROM outbox WHERE ticket IS NULL AND created_at <= ?", (now - DRAFT_LIFETIME,))

    def apply(self, update):
        update = _object(update)
        update_id = update.get("update_id")
        if not _positive(update_id):
            return False
        now = self._time()
        with self.db:
            self._expire(now)
            inserted = self.db.execute(
                "INSERT OR IGNORE INTO seen VALUES (?, ?)", (update_id, now)
            )
            if not inserted.rowcount:
                return False
            callback = update.get("callback_query")
            if isinstance(callback, dict):
                self._callback(callback, now)
            elif isinstance(update.get("message"), dict):
                self._message(update["message"], now)
        return True

    def _job(self, method, payload, purpose, now, ticket=None):
        return self.db.execute("""
            INSERT INTO outbox(method, payload, purpose, ticket, ready_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (method, json.dumps(payload, ensure_ascii=False), purpose, ticket, now, now)).lastrowid

    def _text(self, chat_id, text, now, *, purpose="notice", ticket=None, markup=None):
        payload = {
            "chat_id": chat_id,
            "text": text,
            "link_preview_options": {"is_disabled": True},
        }
        if markup:
            payload["reply_markup"] = markup
        return self._job("sendMessage", payload, purpose, now, ticket)

    def _draft(self, chat_id):
        return self.db.execute("SELECT * FROM drafts WHERE chat_id = ?", (chat_id,)).fetchone()

    def _direct_support(self, chat_id):
        return self.db.execute("SELECT * FROM direct_support WHERE chat_id = ?", (chat_id,)).fetchone()

    def _help(self, chat_id, now):
        self._text(
            chat_id,
            "Доступные команды\n"
            "/start — открыть редактор\n"
            "/support — сообщить о проблеме\n"
            "/help — показать команды",
            now, markup=_editor_keyboard(include_support=True),
        )

    def _begin(self, chat_id, now):
        draft = self._draft(chat_id)
        direct = self._direct_support(chat_id)
        if draft is not None and direct is None:
            self._text(
                chat_id,
                "У вас есть черновик. Чтобы передать его владельцу, нажмите «Отправить» под этим сообщением. "
                "Для нового обращения отмените черновик и снова откройте /support.",
                now, markup=_draft_keyboard(draft["token"]),
            )
            self._progress(chat_id, draft["token"], draft["description"], json.loads(draft["photos"]), now)
            return
        if draft is None:
            token = secrets.token_hex(8)
            self.db.execute("INSERT INTO drafts VALUES (?, ?, '', '[]', ?)", (chat_id, token, now))
            direct = None
        else:
            self.db.execute("UPDATE drafts SET touched_at = ? WHERE chat_id = ?", (now, chat_id))
        notice = self._text(
            chat_id,
            "Напишите, что случилось, и отправьте сообщение обычной кнопкой Telegram. "
            "Описание и до пяти скриншотов получит владелец InteriorsEditor в личный чат. "
            "Скриншоты отправляйте как фото. Их можно добавить до описания или в течение 15 минут после него. "
            "Уберите из обращения адреса, пароли и коды. Для отмены используйте /cancel. Условия обработки\n"
            + POLICY_URL,
            now, purpose="support-intro",
        )
        intro_job = None if direct is not None and direct["intro_job"] is None else notice
        self.db.execute("INSERT OR REPLACE INTO direct_support (chat_id, intro_job, expires_at) VALUES (?, ?, ?)",
                        (chat_id, intro_job, now + DRAFT_LIFETIME))

    def _progress(self, chat_id, token, description, photos, now):
        text = f"Принято фото: {len(photos)} из {MAX_PHOTOS}. "
        text += "Проверьте вложения и нажмите «Отправить»." if description else "Добавьте описание проблемы."
        self._text(chat_id, text, now, markup=_draft_keyboard(token))

    def _message(self, message, now):
        chat_id = _private_chat(message, _object(message.get("from")))
        if chat_id is None:
            return
        message_date = message.get("date")
        if self.bot_started_at is not None and type(message_date) is int and message_date < self.bot_started_at:
            return
        text = message.get("text")
        text = text.strip() if isinstance(text, str) else ""
        if text.startswith("/start support_bind_"):
            return
        if text in ("/support", "/start support"):
            self._begin(chat_id, now)
        elif text == "/start" or text.startswith("/start "):
            self._text(
                chat_id,
                "Создайте план комнаты в 2D, расставьте мебель и посмотрите результат в 3D. "
                "Проекты хранятся на вашем устройстве. Для обращения воспользуйтесь /support.",
                now, markup=_editor_keyboard(include_support=True),
            )
        elif text == "/help":
            self._help(chat_id, now)
        elif text == "/cancel":
            self._cancel(chat_id, now)
        elif chat_id == self.owner_id and isinstance(message.get("reply_to_message"), dict):
            self._owner_reply(message["reply_to_message"], text, now)
        else:
            draft = self._draft(chat_id)
            direct = self._direct_support(chat_id)
            if draft is not None:
                self._edit_draft(chat_id, draft, direct, message, text, now)
            else:
                photo = _largest_photo(message.get("photo"))
                if direct is not None and direct["ticket"] and photo is not None:
                    self._attach_photo(chat_id, direct, photo, now)
                else:
                    self._help(chat_id, now)

    def _cancel(self, chat_id, now):
        closed = self.db.execute("DELETE FROM direct_support WHERE chat_id = ?", (chat_id,)).rowcount
        if self.db.execute("DELETE FROM drafts WHERE chat_id = ?", (chat_id,)).rowcount:
            self._text(chat_id, "Черновик обращения отменён.", now)
        elif closed:
            self._text(chat_id, "Приём фото к обращению закрыт.", now)
        else:
            self._help(chat_id, now)

    def _edit_draft(self, chat_id, draft, direct, message, text, now):
        if text.startswith("/"):
            self._help(chat_id, now)
            return
        if direct is not None and direct["intro_job"] is not None:
            self._text(chat_id, "Дождитесь инструкции от бота и отправьте сообщение ещё раз.", now)
            return
        token = draft["token"]
        markup = _draft_keyboard(token) if direct is None else None
        photos = json.loads(draft["photos"])
        photo = _largest_photo(message.get("photo"))
        if not text and photo is None:
            self._text(chat_id, "Добавьте описание текстом, а скриншот отправьте как фото.", now, markup=markup)
            return
        if photo is not None and not text and isinstance(message.get("caption"), str):
            text = message["caption"].strip()
        if len(text) > MAX_TEXT:
            self._text(chat_id, f"Сократите описание до {MAX_TEXT} символов.", now, markup=markup)
            return
        if photo is not None and len(photos) >= MAX_PHOTOS:
            self._text(chat_id, f"Уже принято максимальное число фото — {MAX_PHOTOS}.", now, markup=_draft_keyboard(token))
            return
        if photo is not None:
            photos.append(photo)
        if direct is not None and text:
            self._submit(chat_id, text, photos, now, direct=True)
            return
        description = text or draft["description"]
        self.db.execute("""
            UPDATE drafts SET description = ?, photos = ?, touched_at = ? WHERE chat_id = ?
        """, (description, json.dumps(photos), now, chat_id))
        if direct is None:
            self._progress(chat_id, token, description, photos, now)
        else:
            self.db.execute("UPDATE direct_support SET expires_at = ? WHERE chat_id = ?",
                            (now + DRAFT_LIFETIME, chat_id))
            self._text(chat_id, f"Получено фото: {len(photos)} из {MAX_PHOTOS}. Теперь пришлите описание проблемы.", now)

    def _callback(self, callback, now):
        chat_id = _private_chat(_object(callback.get("message")), _object(callback.get("from")))
        identifier, data = callback.get("id"), callback.get("data")
        if chat_id is None or not isinstance(identifier, str) or not isinstance(data, str):
            return
        match = re.fullmatch(r"support:(send|cancel):([0-9a-f]{16})", data)
        if not match:
            return
        draft = self._draft(chat_id)
        if draft is None or draft["token"] != match[2] or self._direct_support(chat_id) is not None:
            notice = "Этот черновик уже закрыт. Для нового обращения используйте /support."
        elif match[1] == "cancel":
            self.db.execute("DELETE FROM drafts WHERE chat_id = ?", (chat_id,))
            notice = "Черновик обращения отменён."
            self._text(chat_id, notice, now)
        elif not draft["description"]:
            notice = "Добавьте описание проблемы."
        else:
            self._submit(chat_id, draft["description"], json.loads(draft["photos"]), now)
            notice = "Обращение принято."
        self._job("answerCallbackQuery", {"callback_query_id": identifier, "text": notice}, "callback", now)

    def _submit(self, chat_id, description, photos, now, *, direct=False):
        number = secrets.token_hex(8).upper()
        self.db.execute("INSERT INTO tickets VALUES (?, ?, ?)", (number, chat_id, now))
        self.db.execute("DELETE FROM drafts WHERE chat_id = ?", (chat_id,))
        receipt = f"Обращение №{number} принято. Ответ придёт в этот чат."
        if direct:
            self.db.execute("UPDATE direct_support SET ticket = ?, photo_count = ?, expires_at = ? WHERE chat_id = ?",
                            (number, len(photos), now + PHOTO_WINDOW, chat_id))
            if len(photos) < MAX_PHOTOS:
                receipt += " В ближайшие 15 минут можно добавить скриншоты как фото. Чтобы закрыть приём фото, отправьте /cancel."
        self._text(chat_id, receipt, now, purpose="receipt", ticket=number)
        self._text(
            self.owner_id, f"Обращение №{number}\n\n{description}\n\n"
            "Чтобы ответить автору, ответьте на это сообщение или на скриншот обращения.",
            now, purpose="owner-anchor", ticket=number,
        )
        for photo in photos:
            self._send_photo(number, photo, now)

    def _attach_photo(self, chat_id, direct, photo, now):
        count = direct["photo_count"]
        if count >= MAX_PHOTOS:
            self._text(chat_id, f"Уже принято максимальное число фото — {MAX_PHOTOS}.", now)
            return
        number = direct["ticket"]
        self.db.execute("UPDATE direct_support SET photo_count = ? WHERE chat_id = ?", (count + 1, chat_id))
        self._send_photo(number, photo, now)
        self._text(chat_id, f"Фото добавлено к обращению №{number}. Получено {count + 1} из {MAX_PHOTOS}.", now)

    def _send_photo(self, number, photo, now):
        self._job("sendPhoto", {
            "chat_id": self.owner_id, "photo": photo, "caption": f"Скриншот к обращению №{number}",
        }, "owner-anchor", now, number)

    def _owner_reply(self, quoted, text, now):
        message_id = quoted.get("message_id")
        ticket = self.db.execute("""
            SELECT tickets.number, tickets.author FROM tickets JOIN owner_messages
            ON tickets.number = owner_messages.ticket WHERE owner_messages.message_id = ?
        """, (message_id,)).fetchone() if _positive(message_id) else None
        if ticket is None:
            self._text(self.owner_id, "Привязка к обращению не найдена или срок ответа истёк.", now)
            return
        if not text or len(text) > MAX_TEXT:
            self._text(self.owner_id, f"Ответьте текстом длиной до {MAX_TEXT} символов.", now)
            return
        number = ticket["number"]
        self.db.execute("UPDATE tickets SET touched_at = ? WHERE number = ?", (now, number))
        self._text(ticket["author"], f"Ответ по обращению №{number}\n\n{text}", now, purpose="reply", ticket=number)

    def deliver_one(self, send):
        now = self._time()
        with self.db:
            self._expire(now)
            job = self.db.execute("""
                SELECT * FROM outbox WHERE state = 'queued' AND ready_at <= ?
                ORDER BY id LIMIT 1
            """, (now,)).fetchone()
            if job is None:
                return False
            self.db.execute("UPDATE outbox SET state = 'sending', attempts = attempts + 1 WHERE id = ?", (job["id"],))
        try:
            result = send(job["method"], json.loads(job["payload"]))
            message_id = _object(result).get("message_id")
            if job["method"] == "answerCallbackQuery" and result is not True:
                raise DeliveryError("unknown", code="invalid_ack")
            if job["method"] != "answerCallbackQuery" and not _positive(message_id):
                raise DeliveryError("unknown", code="invalid_ack")
        except DeliveryError as error:
            self._delivery_failed(job, error)
        except Exception:
            self._delivery_failed(job, DeliveryError("unknown", code="transport_error"))
        else:
            self._delivered(job, message_id)
        return True

    def _delivered(self, job, message_id):
        now = self._time()
        number = job["ticket"]
        with self.db:
            if job["purpose"] == "support-intro":
                self.db.execute("UPDATE direct_support SET intro_job = NULL WHERE intro_job = ?", (job["id"],))
            if job["purpose"] == "owner-anchor":
                self.db.execute("INSERT INTO owner_messages VALUES (?, ?)", (message_id, number))
            if job["purpose"] in ("owner-anchor", "reply"):
                self.db.execute("UPDATE tickets SET touched_at = ? WHERE number = ?", (now, number))
            if job["purpose"] == "reply":
                self._text(self.owner_id, f"Ответ по обращению №{number} доставлен.", now, ticket=number)
            self.db.execute("DELETE FROM outbox WHERE id = ?", (job["id"],))

    def _delivery_failed(self, job, error):
        now = self._time()
        attempts = job["attempts"] + 1
        with self.db:
            if error.kind == "retry" and attempts < 8:
                delay = max(error.delay, min(2**attempts, 300))
                self.db.execute("""
                    UPDATE outbox SET state = 'queued', code = ?, ready_at = ? WHERE id = ?
                """, (error.code, now + delay, job["id"]))
                return
            state = "uncertain" if error.kind == "unknown" else "rejected"
            if state == "rejected":
                self.db.execute("UPDATE outbox SET payload = '{}' WHERE id = ?", (job["id"],))
            self.db.execute("UPDATE outbox SET state = ?, code = ? WHERE id = ?", (state, error.code, job["id"]))
            if job["purpose"] == "reply":
                number = job["ticket"]
                text = (
                    f"Статус ответа по обращению №{number} неизвестен. Проверьте отправку."
                    if state == "uncertain" else
                    f"Бот не смог доставить ответ по обращению №{number}."
                )
                self._text(self.owner_id, text, now, ticket=number)

    def summary(self):
        counts = {row["state"]: row["count"] for row in self.db.execute(
            "SELECT state, COUNT(*) AS count FROM outbox GROUP BY state"
        )}
        unresolved = [dict(row) for row in self.db.execute("""
            SELECT id, ticket, purpose, state, code FROM outbox WHERE state IN ('uncertain', 'rejected')
            ORDER BY id LIMIT 50
        """)]
        return {"counts": counts, "unresolved": unresolved}

    def retry_uncertain(self, job_id):
        with self.db:
            self._expire(self._time())
            return bool(self.db.execute("""
                UPDATE outbox SET state = 'queued', code = NULL, attempts = 0, ready_at = ?
                WHERE id = ? AND state = 'uncertain'
            """, (self._time(), job_id)).rowcount)
