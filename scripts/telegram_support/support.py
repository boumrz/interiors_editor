"""Durable Telegram support conversations and delivery queue."""

import json
import re
import secrets
import sqlite3
import time

if __package__:
    from .messages import copy
else:
    from messages import copy


EDITOR_URL = "https://t.me/InteriorsEditorBot?startapp"
EDITOR_WEB_URL = "https://domiknote.ru/"
POLICY_URL = "https://domiknote.ru/legal/2026-11-24.2/telegram-support-privacy.html"
ENGLISH_POLICY_URL = "https://domiknote.ru/legal/2026-11-24.2/en/telegram-support-privacy.html"
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
    draft_token TEXT,
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
CREATE TABLE IF NOT EXISTS language_preferences (
    chat_id INTEGER PRIMARY KEY,
    language TEXT NOT NULL CHECK(language IN ('ru', 'en')),
    revision INTEGER NOT NULL CHECK(revision > 0)
);
CREATE TABLE IF NOT EXISTS language_menu_jobs (
    chat_id INTEGER PRIMARY KEY REFERENCES language_preferences(chat_id) ON DELETE CASCADE,
    job_id INTEGER NOT NULL REFERENCES outbox(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ticket_languages (
    ticket TEXT PRIMARY KEY REFERENCES tickets(number) ON DELETE CASCADE,
    language TEXT NOT NULL CHECK(language IN ('ru', 'en'))
);
CREATE TABLE IF NOT EXISTS owner_languages (
    chat_id INTEGER PRIMARY KEY,
    language TEXT NOT NULL CHECK(language IN ('ru', 'en'))
);
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


def _sent_at(message, now):
    date = message.get("date")
    return min(date, now) if _positive(date) else now


def _is_direct_draft(draft, direct):
    return direct is not None and direct["draft_token"] == draft["token"]


def _private_chat(message, actor):
    chat = _object(message.get("chat"))
    chat_id = chat.get("id")
    return chat_id if (
        chat.get("type") == "private" and _positive(chat_id)
        and _positive(actor.get("id")) and actor["id"] == chat_id
        and actor.get("is_bot") is False
    ) else None


def _telegram_language(actor):
    tag = actor.get("language_code")
    return "ru" if isinstance(tag, str) and tag.lower().partition("-")[0] == "ru" else "en"


def _editor_keyboard(language, token, include_support=False):
    url = EDITOR_URL if token is None else f"{EDITOR_URL}={token}"
    rows = [[{"text": copy(language, "editor"), "url": url}]]
    if include_support:
        rows.append([{"text": copy(language, "support"), "url": "https://t.me/InteriorsEditorBot?start=support"}])
    return {"inline_keyboard": rows}


def _draft_keyboard(language, token):
    return {"inline_keyboard": [[
        {"text": copy(language, "send"), "callback_data": f"support:send:{token}"},
        {"text": copy(language, "cancel"), "callback_data": f"support:cancel:{token}"},
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

    def __init__(self, db_path, owner_id, *, clock=time.time, bot_started_at=None,
                 recover_inflight=True, language_token=None):
        if not _positive(owner_id):
            raise ValueError("Invalid owner identity")
        self.owner_id = owner_id
        self.clock = clock
        self.bot_started_at = bot_started_at
        self.language_token = language_token
        self.db = sqlite3.connect(db_path)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.execute("PRAGMA journal_mode = WAL")
        self.db.execute("PRAGMA synchronous = FULL")
        self.db.executescript(SCHEMA)
        if recover_inflight:
            with self.db:
                self.db.execute("""
                    UPDATE outbox SET state = 'queued', code = NULL
                    WHERE state = 'sending' AND purpose = 'language-menu'
                """)
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
        # Keep closed photo windows briefly so delayed Telegram updates can be checked by send time.
        self.db.execute("""
            DELETE FROM direct_support WHERE expires_at <= ?
            AND (ticket IS NULL OR expires_at <= ?)
        """, (now, now - DRAFT_LIFETIME))
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

    def _preference(self, chat_id):
        return self.db.execute("SELECT language, revision FROM language_preferences WHERE chat_id = ?",
                               (chat_id,)).fetchone()

    def _language(self, chat_id, fallback):
        preference = self._preference(chat_id)
        return preference["language"] if preference is not None else fallback

    def _actor_language(self, chat_id, actor):
        language = _telegram_language(actor)
        if chat_id == self.owner_id:
            self.db.execute("INSERT OR REPLACE INTO owner_languages VALUES (?, ?)", (chat_id, language))
        return self._language(chat_id, language)

    def _owner_language(self):
        observed = self.db.execute("SELECT language FROM owner_languages WHERE chat_id = ?",
                                   (self.owner_id,)).fetchone()
        return self._language(self.owner_id, observed["language"] if observed is not None else "en")

    def _editor_token(self, chat_id):
        preference = self._preference(chat_id)
        if self.language_token is not None and preference is not None:
            return self.language_token(chat_id, preference["language"], preference["revision"])
        return None

    def _choose_language(self, chat_id, language, now):
        self._text(chat_id, copy(language, "choose_language"), now, markup={"inline_keyboard": [[
            {"text": "Русский", "callback_data": "language:ru"},
            {"text": "English", "callback_data": "language:en"},
        ]]})

    def _set_language(self, chat_id, language, now):
        self.db.execute("""
            INSERT INTO language_preferences VALUES (?, ?, 1)
            ON CONFLICT(chat_id) DO UPDATE SET language = excluded.language, revision = revision + 1
            WHERE language != excluded.language
        """, (chat_id, language))
        # A stale menu retry must never replace the latest selection.
        self.db.execute("DELETE FROM outbox WHERE id = (SELECT job_id FROM language_menu_jobs WHERE chat_id = ?)",
                        (chat_id,))
        token = self._editor_token(chat_id)
        if token is not None:
            job = self._job("setChatMenuButton", {
                "chat_id": chat_id,
                "menu_button": {
                    "type": "web_app", "text": copy(language, "editor"),
                    "web_app": {"url": f"{EDITOR_WEB_URL}?language_token={token}"},
                },
            }, "language-menu", now)
            self.db.execute("INSERT INTO language_menu_jobs VALUES (?, ?)", (chat_id, job))
        message = "language_saved" if token is not None else "language_editor_pending"
        self._text(chat_id, copy(language, message), now, markup=_editor_keyboard(language, token))

    def _help(self, chat_id, language, now):
        self._text(
            chat_id, copy(language, "help"), now,
            markup=_editor_keyboard(language, self._editor_token(chat_id), include_support=True),
        )

    def _begin(self, chat_id, language, now):
        draft = self._draft(chat_id)
        direct = self._direct_support(chat_id)
        if draft is not None and not _is_direct_draft(draft, direct):
            self._text(
                chat_id, copy(language, "old_draft"), now,
                markup=_draft_keyboard(language, draft["token"]),
            )
            self._progress(chat_id, language, draft["token"], draft["description"], json.loads(draft["photos"]), now)
            return
        if draft is None:
            token = secrets.token_hex(8)
            self.db.execute("INSERT INTO drafts VALUES (?, ?, '', '[]', ?)", (chat_id, token, now))
            direct = None
        else:
            token = draft["token"]
            self.db.execute("UPDATE drafts SET touched_at = ? WHERE chat_id = ?", (now, chat_id))
        notice = self._text(
            chat_id, copy(language, "support_intro", policy=POLICY_URL if language == "ru" else ENGLISH_POLICY_URL),
            now, purpose="support-intro",
        )
        intro_job = None if direct is not None and direct["intro_job"] is None else notice
        self.db.execute("""
            INSERT OR REPLACE INTO direct_support (chat_id, draft_token, intro_job, expires_at)
            VALUES (?, ?, ?, ?)
        """, (chat_id, token, intro_job, now + DRAFT_LIFETIME))

    def _progress(self, chat_id, language, token, description, photos, now):
        text = copy(language, "progress", count=len(photos), limit=MAX_PHOTOS)
        text += copy(language, "check_attachments" if description else "add_description")
        self._text(chat_id, text, now, markup=_draft_keyboard(language, token))

    def _message(self, message, now):
        actor = _object(message.get("from"))
        chat_id = _private_chat(message, actor)
        if chat_id is None:
            return
        message_date = message.get("date")
        if self.bot_started_at is not None and type(message_date) is int and message_date < self.bot_started_at:
            return
        text = message.get("text")
        text = text.strip() if isinstance(text, str) else ""
        if text.startswith("/start support_bind_"):
            return
        language = self._actor_language(chat_id, actor)
        if text in ("/support", "/start support"):
            self._begin(chat_id, language, now)
        elif text == "/start" or text.startswith("/start "):
            self._text(
                chat_id, copy(language, "welcome"), now,
                markup=_editor_keyboard(language, self._editor_token(chat_id), include_support=True),
            )
        elif text == "/help":
            self._help(chat_id, language, now)
        elif text == "/language":
            self._choose_language(chat_id, language, now)
        elif text == "/cancel":
            self._cancel(chat_id, language, now)
        elif chat_id == self.owner_id and isinstance(message.get("reply_to_message"), dict):
            self._owner_reply(language, message["reply_to_message"], text, now)
        else:
            draft = self._draft(chat_id)
            direct = self._direct_support(chat_id)
            if draft is not None:
                direct_draft = direct if _is_direct_draft(draft, direct) else None
                self._edit_draft(chat_id, language, draft, direct_draft, message, text, now)
            else:
                photo = _largest_photo(message.get("photo"))
                if (direct is not None and direct["ticket"] and photo is not None
                        and _sent_at(message, now) < direct["expires_at"]):
                    self._attach_photo(chat_id, language, direct, photo, now)
                else:
                    self._help(chat_id, language, now)

    def _cancel(self, chat_id, language, now):
        closed = self.db.execute("DELETE FROM direct_support WHERE chat_id = ?", (chat_id,)).rowcount
        if self.db.execute("DELETE FROM drafts WHERE chat_id = ?", (chat_id,)).rowcount:
            self._text(chat_id, copy(language, "draft_cancelled"), now)
        elif closed:
            self._text(chat_id, copy(language, "photo_window_closed"), now)
        else:
            self._help(chat_id, language, now)

    def _edit_draft(self, chat_id, language, draft, direct, message, text, now):
        if text.startswith("/"):
            self._help(chat_id, language, now)
            return
        if direct is not None and direct["intro_job"] is not None:
            self._text(chat_id, copy(language, "wait_for_intro"), now)
            return
        token = draft["token"]
        markup = _draft_keyboard(language, token) if direct is None else None
        photos = json.loads(draft["photos"])
        photo = _largest_photo(message.get("photo"))
        if not text and photo is None:
            self._text(chat_id, copy(language, "invalid_attachment"), now, markup=markup)
            return
        if photo is not None and not text and isinstance(message.get("caption"), str):
            text = message["caption"].strip()
        if len(text) > MAX_TEXT:
            self._text(chat_id, copy(language, "description_limit", limit=MAX_TEXT), now, markup=markup)
            return
        if photo is not None and len(photos) >= MAX_PHOTOS:
            self._text(chat_id, copy(language, "photo_limit", limit=MAX_PHOTOS), now, markup=markup)
            if direct is None or not text:
                return
        elif photo is not None:
            photos.append(photo)
        if direct is not None and text:
            self._submit(chat_id, language, text, photos, now, direct_sent_at=_sent_at(message, now))
            return
        description = text or draft["description"]
        self.db.execute("""
            UPDATE drafts SET description = ?, photos = ?, touched_at = ? WHERE chat_id = ?
        """, (description, json.dumps(photos), now, chat_id))
        if direct is None:
            self._progress(chat_id, language, token, description, photos, now)
        else:
            self.db.execute("UPDATE direct_support SET expires_at = ? WHERE chat_id = ?",
                            (now + DRAFT_LIFETIME, chat_id))
            self._text(chat_id, copy(language, "photo_before_description", count=len(photos), limit=MAX_PHOTOS), now)

    def _callback(self, callback, now):
        actor = _object(callback.get("from"))
        chat_id = _private_chat(_object(callback.get("message")), actor)
        identifier, data = callback.get("id"), callback.get("data")
        if chat_id is None or not isinstance(identifier, str) or not isinstance(data, str):
            return
        match_language = re.fullmatch(r"language:(ru|en)", data)
        if match_language:
            self._job("answerCallbackQuery", {"callback_query_id": identifier}, "callback", now)
            self._set_language(chat_id, match_language[1], now)
            return
        language = self._actor_language(chat_id, actor)
        match = re.fullmatch(r"support:(send|cancel):([0-9a-f]{16})", data)
        if not match:
            return
        draft = self._draft(chat_id)
        if draft is None or draft["token"] != match[2] or _is_direct_draft(draft, self._direct_support(chat_id)):
            notice = "already_closed"
        elif match[1] == "cancel":
            self._cancel(chat_id, language, now)
            notice = "draft_cancelled"
        elif not draft["description"]:
            notice = "add_description"
        else:
            self._submit(chat_id, language, draft["description"], json.loads(draft["photos"]), now)
            notice = "received"
        self._job("answerCallbackQuery", {"callback_query_id": identifier, "text": copy(language, notice)}, "callback", now)

    def _submit(self, chat_id, language, description, photos, now, *, direct_sent_at=None):
        number = secrets.token_hex(8).upper()
        self.db.execute("INSERT INTO tickets VALUES (?, ?, ?)", (number, chat_id, now))
        self.db.execute("INSERT INTO ticket_languages VALUES (?, ?)", (number, language))
        self.db.execute("DELETE FROM drafts WHERE chat_id = ?", (chat_id,))
        receipt = copy(language, "receipt", number=number)
        if direct_sent_at is None:
            self.db.execute("DELETE FROM direct_support WHERE chat_id = ?", (chat_id,))
        else:
            deadline = direct_sent_at + PHOTO_WINDOW
            self.db.execute("""
                UPDATE direct_support SET ticket = ?, draft_token = NULL, photo_count = ?, expires_at = ?
                WHERE chat_id = ?
            """, (number, len(photos), deadline, chat_id))
            if len(photos) < MAX_PHOTOS and now < deadline:
                receipt += copy(language, "receipt_photos")
        self._text(chat_id, receipt, now, purpose="receipt", ticket=number)
        owner_language = self._owner_language()
        self._text(
            self.owner_id, copy(owner_language, "owner_report", number=number, description=description),
            now, purpose="owner-anchor", ticket=number,
        )
        for photo in photos:
            self._send_photo(number, photo, now)

    def _attach_photo(self, chat_id, language, direct, photo, now):
        count = direct["photo_count"]
        if count >= MAX_PHOTOS:
            self._text(chat_id, copy(language, "photo_limit", limit=MAX_PHOTOS), now)
            return
        number = direct["ticket"]
        self.db.execute("UPDATE direct_support SET photo_count = ? WHERE chat_id = ?", (count + 1, chat_id))
        self._send_photo(number, photo, now)
        self._text(chat_id, copy(language, "photo_receipt", number=number, count=count + 1, limit=MAX_PHOTOS), now)

    def _send_photo(self, number, photo, now):
        language = self._owner_language()
        self._job("sendPhoto", {
            "chat_id": self.owner_id, "photo": photo, "caption": copy(language, "owner_photo", number=number),
        }, "owner-anchor", now, number)

    def _owner_reply(self, owner_language, quoted, text, now):
        message_id = quoted.get("message_id")
        ticket = self.db.execute("""
            SELECT tickets.number, tickets.author, ticket_languages.language
            FROM tickets JOIN owner_messages ON tickets.number = owner_messages.ticket
            LEFT JOIN ticket_languages ON tickets.number = ticket_languages.ticket
            WHERE owner_messages.message_id = ?
        """, (message_id,)).fetchone() if _positive(message_id) else None
        if ticket is None:
            self._text(self.owner_id, copy(owner_language, "owner_ticket_missing"), now)
            return
        if not text or len(text) > MAX_TEXT:
            self._text(self.owner_id, copy(owner_language, "owner_reply_limit", limit=MAX_TEXT), now)
            return
        number = ticket["number"]
        self.db.execute("UPDATE tickets SET touched_at = ? WHERE number = ?", (now, number))
        language = self._language(ticket["author"], ticket["language"] or "ru")
        self._text(ticket["author"], copy(language, "reply", number=number, text=text), now,
                   purpose="reply", ticket=number)

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
            if job["method"] in ("answerCallbackQuery", "setChatMenuButton"):
                accepted = result is True
            else:
                accepted = _positive(message_id)
            if not accepted:
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
                language = self._owner_language()
                self._text(self.owner_id, copy(language, "reply_delivered", number=number), now, ticket=number)
            self.db.execute("DELETE FROM outbox WHERE id = ?", (job["id"],))

    def _delivery_failed(self, job, error):
        now = self._time()
        attempts = job["attempts"] + 1
        with self.db:
            repeatable = job["purpose"] == "language-menu" and error.kind == "unknown"
            if (error.kind == "retry" or repeatable) and attempts < 8:
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
                language = self._owner_language()
                message = "reply_uncertain" if state == "uncertain" else "reply_rejected"
                self._text(self.owner_id, copy(language, message, number=number), now, ticket=number)

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
