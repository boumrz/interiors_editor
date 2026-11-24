"""Exercise support through Telegram updates, a durable store and the Bot API boundary."""

from pathlib import Path
import re
from tempfile import TemporaryDirectory
import unittest

from scripts.telegram_support.support import DeliveryError, Support


OWNER = 410001
REPORTER = 410002
OUTSIDER = 410003
BOT = 9112733311
DESCRIPTION = "Тест. План не открывается после поворота."
SCREENSHOT = "telegram-screenshot-large"
REPLY = "Спасибо. Исправление на проверке."


class Clock:
    def __init__(self):
        self.now = 1_795_555_000

    def __call__(self):
        return self.now


class Telegram:
    def __init__(self, clock):
        self.clock = clock
        self.calls = []
        self.messages = []
        self.error = None

    def send(self, method, payload):
        self.calls.append((method, payload))
        if self.error:
            failure_method, failure_recipient, error = self.error
            if method == failure_method and payload.get("chat_id") == failure_recipient:
                self.error = None
                raise error
        if method == "answerCallbackQuery":
            return True
        if method not in ("sendMessage", "sendPhoto"):
            raise AssertionError(f"Unexpected Bot API call {method}")
        message = {
            **payload,
            "message_id": 100 + len(self.messages),
            "from": {"id": BOT, "is_bot": True},
            "chat": {"id": payload["chat_id"], "type": "private"},
            "date": int(self.clock()),
        }
        self.messages.append(message)
        return message

    def received(self, chat_id):
        return [message for message in self.messages if message["chat_id"] == chat_id]

    def last_text(self, chat_id):
        return next(message for message in reversed(self.received(chat_id)) if "text" in message)

    def button(self, chat_id, label):
        for message in reversed(self.received(chat_id)):
            for row in message.get("reply_markup", {}).get("inline_keyboard", []):
                for button in row:
                    if label in button["text"]:
                        return message, button["callback_data"]
        raise AssertionError(f"No {label!r} button received by {chat_id}")


class SupportTests(unittest.TestCase):
    def setUp(self):
        directory = self.enterContext(TemporaryDirectory())
        self.db_path = Path(directory) / "support.sqlite3"
        self.clock = Clock()
        self.telegram = Telegram(self.clock)
        self.update_id = 0
        self.support = Support(self.db_path, OWNER, clock=self.clock)
        self.addCleanup(lambda: self.support.close())

    def restart(self):
        self.support.close()
        self.support = Support(self.db_path, OWNER, clock=self.clock)

    def drain(self, send=None):
        send = self.telegram.send if send is None else send
        for _ in range(32):
            if not self.support.deliver_one(send):
                return
        self.fail("The delivery queue did not drain")

    def update(self, **payload):
        self.update_id += 1
        return {"update_id": self.update_id, **payload}

    def message(self, chat_id=REPORTER, text=None, *, sender=None, chat_type="private", **payload):
        if text is not None:
            payload["text"] = text
        return self.update(message={
            "message_id": self.update_id + 1,
            "date": int(self.clock()),
            "from": {"id": chat_id if sender is None else sender, "is_bot": False},
            "chat": {"id": chat_id, "type": chat_type},
            **payload,
        })

    def press(self, label, chat_id=REPORTER):
        message, callback_data = self.telegram.button(chat_id, label)
        return self.update(callback_query={
            "id": f"callback-{self.update_id + 1}",
            "from": {"id": chat_id, "is_bot": False},
            "message": {
                "message_id": message["message_id"],
                "chat": {"id": chat_id, "type": "private"},
                "date": message["date"],
                "from": message["from"],
            },
            "data": callback_data,
        })

    def add_description(self, chat_id=REPORTER, text=DESCRIPTION):
        self.assertTrue(self.support.apply(self.message(chat_id, "/support")))
        self.drain()
        self.assertTrue(self.support.apply(self.message(chat_id, text)))
        self.drain()

    def send_ticket(self, chat_id=REPORTER, text=DESCRIPTION):
        self.add_description(chat_id, text)
        self.assertTrue(self.support.apply(self.press("Отправить", chat_id)))
        self.drain()
        return self.telegram.last_text(OWNER)

    def test_reporter_sends_text_and_photo_and_only_reporter_gets_owner_reply(self):
        self.add_description()
        screenshot = self.message(photo=[
            {"file_id": "telegram-thumbnail", "file_unique_id": "thumb", "width": 32, "height": 32},
            {"file_id": SCREENSHOT, "file_unique_id": "full", "width": 800, "height": 600},
        ])
        self.assertTrue(self.support.apply(screenshot))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        self.assertTrue(self.support.apply(self.press("Отправить")))
        self.drain()
        reporter_ack = self.telegram.last_text(REPORTER)["text"]
        owner_ticket = self.telegram.last_text(OWNER)
        ticket = re.search(r"Обращение\s+№\s*[\w-]+", reporter_ack)
        self.assertIsNotNone(ticket)
        self.assertIn(DESCRIPTION, owner_ticket["text"])
        self.assertIn(ticket[0], owner_ticket["text"])
        self.assertTrue(any(message.get("photo") == SCREENSHOT for message in self.telegram.received(OWNER)))
        self.assertFalse(any(message.get("photo") for message in self.telegram.received(REPORTER)))

        self.assertTrue(self.support.apply(self.message(OWNER, REPLY, reply_to_message=owner_ticket)))
        self.drain()
        self.assertIn(REPLY, self.telegram.last_text(REPORTER)["text"])
        self.assertIn(ticket[0].split("№", 1)[1].strip(), self.telegram.last_text(REPORTER)["text"])
        self.assertIn("доставлен", self.telegram.last_text(OWNER)["text"])
        self.assertEqual(self.telegram.received(OUTSIDER), [])

    def test_duplicate_updates_and_two_send_clicks_survive_restart_as_one_ticket(self):
        start = self.message(text="/support")
        self.assertFalse(self.support.apply({"message": start["message"]}))
        self.assertTrue(self.support.apply(start))
        self.assertFalse(self.support.apply(start))
        self.drain()
        self.assertTrue(self.support.apply(self.message(text=DESCRIPTION)))
        self.drain()
        submit = self.press("Отправить")
        second_click = self.press("Отправить")
        self.assertTrue(self.support.apply(submit))
        self.restart()
        self.assertFalse(self.support.apply(submit))
        self.assertTrue(self.support.apply(second_click))
        self.drain()

        owner_tickets = [
            message for message in self.telegram.received(OWNER)
            if "Обращение №" in message.get("text", "")
        ]
        self.assertEqual(len(owner_tickets), 1)
        self.assertIn(DESCRIPTION, owner_tickets[0]["text"])
        self.restart()
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), owner_tickets)

    def test_group_and_spoofed_owner_or_unknown_quoted_message_never_route(self):
        self.assertTrue(self.support.apply(self.message(-53, "/support", chat_type="group", sender=REPORTER)))
        self.assertTrue(self.support.apply(self.message(
            BOT, "/support", **{"from": {"id": BOT, "is_bot": True}},
        )))
        self.drain()
        self.assertEqual(self.telegram.received(-53), [])
        self.assertEqual(self.telegram.received(BOT), [])
        self.assertTrue(self.support.apply(self.message(text="Текст до команды поддержки.")))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])

        owner_ticket = self.send_ticket()
        original_reporter_conversation = self.telegram.received(REPORTER)
        self.support.apply(self.message(OUTSIDER, REPLY, reply_to_message=owner_ticket))
        self.support.apply(self.message(OWNER, REPLY, sender=OUTSIDER, reply_to_message=owner_ticket))
        self.support.apply(self.message(OUTSIDER, REPLY, sender=OWNER, reply_to_message=owner_ticket))
        self.support.apply(self.message(OWNER, REPLY, reply_to_message={**owner_ticket, "message_id": 99999}))
        self.drain()
        self.assertEqual(self.telegram.received(REPORTER), original_reporter_conversation)
        self.assertFalse(any(REPLY in message.get("text", "") for message in self.telegram.received(OUTSIDER)))

    def test_binding_messages_are_quiet_and_normal_start_still_opens_editor(self):
        nonce = "a9e0f08bd0e68cf8d261807b4578fbd6"
        self.support.apply(self.message(OWNER, f"/start support_bind_{nonce}"))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])

        self.support.apply(self.message(OWNER, "/start"))
        self.drain()
        buttons = self.telegram.last_text(OWNER)["reply_markup"]["inline_keyboard"]
        self.assertIn(
            {"text": "Открыть редактор", "url": "https://t.me/InteriorsEditorBot?startapp"},
            buttons[0],
        )

    def test_two_reporters_get_replies_only_for_the_quoted_ticket(self):
        first_ticket = self.send_ticket()
        other_ticket = self.send_ticket(OUTSIDER, "Второе обращение для проверки маршрута.")
        self.assertNotEqual(first_ticket["message_id"], other_ticket["message_id"])
        other_conversation = self.telegram.received(OUTSIDER)
        self.support.apply(self.message(OWNER, REPLY, reply_to_message=first_ticket))
        self.drain()
        self.assertIn(REPLY, self.telegram.last_text(REPORTER)["text"])
        self.assertEqual(self.telegram.received(OUTSIDER), other_conversation)

        reply = "Ответ на второе обращение."
        self.support.apply(self.message(OWNER, reply, reply_to_message=other_ticket))
        self.drain()
        self.assertIn(reply, self.telegram.last_text(OUTSIDER)["text"])
        self.assertIn(REPLY, self.telegram.last_text(REPORTER)["text"])

    def test_cancelled_or_expired_draft_rejects_old_send_button(self):
        self.add_description()
        old_submit = self.press("Отправить")
        self.assertTrue(self.support.apply(self.press("Отмена")))
        self.drain()

        self.add_description(text="Новое обращение, которое истечёт.")
        self.assertTrue(self.support.apply(old_submit))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        self.clock.now += 24 * 60 * 60 + 1
        self.assertTrue(self.support.apply(self.press("Отправить")))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])

        self.send_ticket(text="Черновик после истечения.")
        self.assertIn("Черновик после истечения.", self.telegram.last_text(OWNER)["text"])

    def test_album_photo_limit_and_missing_description(self):
        self.assertTrue(self.support.apply(self.message(text="/support")))
        self.drain()
        for count in range(6):
            self.assertTrue(self.support.apply(self.message(
                photo=[{
                    "file_id": f"screenshot-{count}",
                    "file_unique_id": f"unique-{count}",
                    "width": 800,
                    "height": 600,
                }],
                media_group_id="test-album",
            )))
        self.drain()
        self.assertTrue(self.support.apply(self.press("Отправить")))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])

        self.assertTrue(self.support.apply(self.message(text=DESCRIPTION)))
        self.drain()
        self.assertTrue(self.support.apply(self.press("Отправить")))
        self.drain()
        owner_photos = [message["photo"] for message in self.telegram.received(OWNER) if "photo" in message]
        self.assertEqual(owner_photos, [f"screenshot-{count}" for count in range(5)])
        self.assertIn(DESCRIPTION, self.telegram.last_text(OWNER)["text"])

    def test_description_limit_and_unsupported_attachment_leave_draft_ready_to_correct(self):
        self.support.apply(self.message(text="/support"))
        self.drain()
        description = "А" * 3000
        self.support.apply(self.message(text=description + "Б"))
        self.support.apply(self.message(document={
            "file_id": "not-a-photo",
            "file_unique_id": "not-a-photo-unique",
            "mime_type": "application/octet-stream",
            "file_name": "backup.interiors",
        }))
        self.drain()
        self.support.apply(self.press("Отправить"))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        self.support.apply(self.message(text=description))
        self.drain()
        self.support.apply(self.press("Отправить"))
        self.drain()
        self.assertIn(description, self.telegram.last_text(OWNER)["text"])
        self.assertFalse(any(message.get("photo") for message in self.telegram.received(OWNER)))

    def test_owner_delivery_retries_only_after_retry_after_across_restart(self):
        self.add_description()
        self.support.apply(self.press("Отправить"))
        self.telegram.error = ("sendMessage", OWNER, DeliveryError(kind="retry", delay=30, code="429"))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])

        self.restart()
        self.clock.now += 29
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        self.clock.now += 1
        self.drain()
        self.assertIn(DESCRIPTION, self.telegram.last_text(OWNER)["text"])
        self.assertEqual(sum(
            method == "sendMessage" and payload.get("chat_id") == OWNER
            for method, payload in self.telegram.calls
        ), 2)

    def test_ambiguous_owner_delivery_is_not_repeated_after_restart(self):
        self.add_description()
        self.support.apply(self.press("Отправить"))
        self.telegram.error = ("sendMessage", OWNER, DeliveryError(kind="unknown", code="response-lost"))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        self.restart()
        self.clock.now += 60 * 60
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        self.assertEqual(sum(
            method == "sendMessage" and payload.get("chat_id") == OWNER
            for method, payload in self.telegram.calls
        ), 1)
        unresolved, = self.support.summary()["unresolved"]
        self.assertEqual(unresolved["state"], "uncertain")
        self.assertEqual(unresolved["code"], "response-lost")
        self.assertTrue(self.support.retry_uncertain(unresolved["id"]))
        self.assertFalse(self.support.retry_uncertain(unresolved["id"]))
        self.drain()
        self.assertIn(DESCRIPTION, self.telegram.last_text(OWNER)["text"])
        self.assertEqual(self.support.summary()["unresolved"], [])

    def test_interrupted_attempt_after_claim_requires_reconciliation(self):
        self.add_description()
        self.support.apply(self.press("Отправить"))
        self.telegram.error = ("sendMessage", OWNER, KeyboardInterrupt())
        with self.assertRaises(KeyboardInterrupt):
            self.drain()
        self.restart()
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        unresolved, = self.support.summary()["unresolved"]
        self.assertEqual(unresolved["state"], "uncertain")
        self.assertEqual(unresolved["code"], "interrupted")

    def test_admin_inspection_does_not_convert_an_active_send_to_uncertain(self):
        self.add_description()
        self.support.apply(self.press("Отправить"))
        snapshots = []

        def inspect_before_send(method, payload):
            if method == "sendMessage" and payload.get("chat_id") == OWNER:
                inspection = Support(self.db_path, OWNER, clock=self.clock, recover_inflight=False)
                try:
                    snapshots.append(inspection.summary())
                finally:
                    inspection.close()
            return self.telegram.send(method, payload)

        self.drain(inspect_before_send)
        self.assertEqual(len(snapshots), 1)
        self.assertEqual(snapshots[0]["counts"].get("sending"), 1)
        self.assertEqual(snapshots[0]["unresolved"], [])
        self.assertEqual(self.support.summary()["unresolved"], [])
        self.assertIn(DESCRIPTION, self.telegram.last_text(OWNER)["text"])

    def test_rejected_reply_reports_failure_to_owner(self):
        ticket = self.send_ticket()
        original_reporter_conversation = self.telegram.received(REPORTER)
        self.telegram.error = ("sendMessage", REPORTER, DeliveryError(kind="rejected", code="403"))
        self.support.apply(self.message(OWNER, REPLY, reply_to_message=ticket))
        self.drain()
        self.assertEqual(self.telegram.received(REPORTER), original_reporter_conversation)
        self.assertIn("не смог доставить", self.telegram.last_text(OWNER)["text"])
        unresolved, = self.support.summary()["unresolved"]
        self.assertEqual(unresolved["state"], "rejected")
        self.assertEqual(unresolved["code"], "403")
        self.assertFalse(self.support.retry_uncertain(unresolved["id"]))

    def test_expired_owner_reply_has_feedback_and_no_message_to_reporter(self):
        ticket = self.send_ticket()
        original_reporter_conversation = self.telegram.received(REPORTER)
        original_owner_conversation = self.telegram.received(OWNER)
        self.clock.now += 30 * 24 * 60 * 60 + 1
        self.support.apply(self.message(OWNER, REPLY, reply_to_message=ticket))
        self.drain()
        self.assertEqual(self.telegram.received(REPORTER), original_reporter_conversation)
        self.assertGreater(len(self.telegram.received(OWNER)), len(original_owner_conversation))
        self.assertNotIn(REPLY, self.telegram.last_text(OWNER)["text"])
