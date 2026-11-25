"""Exercise support through Telegram updates, a durable store and the Bot API boundary."""

from pathlib import Path
import re
import sqlite3
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
        if method in ("answerCallbackQuery", "setChatMenuButton"):
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
        self.support.apply(self.message(OWNER, "/help"))
        self.drain()
        self.telegram = Telegram(self.clock)

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

    def message(self, chat_id=REPORTER, text=None, *, sender=None, chat_type="private",
                language_code="ru", **payload):
        if text is not None:
            payload["text"] = text
        return self.update(message={
            "message_id": self.update_id + 1,
            "date": int(self.clock()),
            "from": {"id": chat_id if sender is None else sender, "is_bot": False,
                     **({} if language_code is None else {"language_code": language_code})},
            "chat": {"id": chat_id, "type": chat_type},
            **payload,
        })

    def press(self, label, chat_id=REPORTER):
        message, callback_data = self.telegram.button(chat_id, label)
        return self.update(callback_query={
            "id": f"callback-{self.update_id + 1}",
            "from": {"id": chat_id, "is_bot": False, "language_code": "ru"},
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

    def send_ticket(self, chat_id=REPORTER, text=DESCRIPTION):
        self.add_description(chat_id, text)
        self.drain()
        return self.telegram.last_text(OWNER)

    def configure_language_token(self):
        def token(chat_id, language, revision):
            return f"lang1_{language}_{revision}_" + ("A" if chat_id == REPORTER else "B") * 86

        self.support.close()
        self.support = Support(self.db_path, OWNER, clock=self.clock, language_token=token)

    def test_bot_uses_telegram_language_and_english_for_other_or_missing_languages(self):
        for language, expected in (("ru-RU", "Открыть редактор"), ("en-US", "Open editor"),
                                   ("fr", "Open editor"), (None, "Open editor")):
            with self.subTest(language=language):
                self.support.apply(self.message(text="/start", language_code=language))
                self.drain()
                keyboard = self.telegram.last_text(REPORTER)["reply_markup"]["inline_keyboard"]
                self.assertEqual(keyboard[0][0]["text"], expected)

    def test_language_choice_persists_and_personalizes_only_the_private_account(self):
        self.configure_language_token()
        self.support.apply(self.message(text="/language", language_code="en"))
        self.drain()
        reply = self.telegram.last_text(REPORTER)
        self.assertIn("Choose a language", reply["text"])
        wrong_account = self.press("Русский")
        wrong_account["callback_query"]["from"]["id"] = OUTSIDER
        self.support.apply(wrong_account)
        choice = self.press("English")
        self.assertTrue(self.support.apply(choice))
        self.assertFalse(self.support.apply(choice))
        self.drain()
        menu, = [body for method, body in self.telegram.calls if method == "setChatMenuButton"]
        self.assertEqual(menu["chat_id"], REPORTER)
        self.assertEqual(menu["menu_button"]["text"], "Open editor")
        self.assertEqual(menu["menu_button"]["type"], "web_app")
        link = menu["menu_button"]["web_app"]["url"]
        token = "lang1_en_1_" + "A" * 86
        self.assertEqual(link, "https://domiknote.ru/?language_token=" + token)
        inline_url = "https://t.me/InteriorsEditorBot?startapp=" + token
        self.assertEqual(self.telegram.last_text(REPORTER)["reply_markup"]["inline_keyboard"][0][0],
                         {"text": "Open editor", "url": inline_url})

        self.configure_language_token()
        self.support.apply(self.message(text="/start", language_code="ru"))
        self.support.apply(self.message(OUTSIDER, "/start", language_code="ru"))
        self.drain()
        self.assertEqual(self.telegram.last_text(REPORTER)["reply_markup"]["inline_keyboard"][0][0],
                         {"text": "Open editor", "url": inline_url})
        self.assertIn("Открыть редактор", str(self.telegram.last_text(OUTSIDER)["reply_markup"]))

    def test_rapid_language_changes_replace_an_uncertain_menu_retry(self):
        self.configure_language_token()
        self.support.apply(self.message(text="/language"))
        self.drain()
        self.telegram.error = ("setChatMenuButton", REPORTER, DeliveryError("unknown", code="response-lost"))
        self.support.apply(self.press("Русский"))
        self.drain()
        self.support.apply(self.press("English"))
        self.support.apply(self.press("Русский"))
        self.configure_language_token()
        self.drain()
        self.clock.now += 3600
        self.drain()
        menus = [body["menu_button"]["web_app"]["url"] for method, body in self.telegram.calls
                 if method == "setChatMenuButton"]
        self.assertEqual(menus, ["https://domiknote.ru/?language_token=lang1_ru_1_" + "A" * 86,
                                 "https://domiknote.ru/?language_token=lang1_ru_3_" + "A" * 86])

    def test_latest_menu_retries_after_an_ambiguous_failure(self):
        self.configure_language_token()
        self.support.apply(self.message(text="/language"))
        self.drain()
        self.telegram.error = ("setChatMenuButton", REPORTER, DeliveryError("unknown", code="response-lost"))
        self.support.apply(self.press("English"))
        self.drain()
        self.configure_language_token()
        self.clock.now += 3600
        self.drain()
        jobs = [body for method, body in self.telegram.calls if method == "setChatMenuButton"]
        self.assertEqual(len(jobs), 2)
        self.assertEqual(jobs[0], jobs[1])

    def test_interrupted_menu_delivery_restarts_without_duplicate_confirmation(self):
        self.configure_language_token()
        self.support.apply(self.message(text="/language"))
        self.drain()
        self.support.apply(self.press("English"))
        self.assertTrue(self.support.deliver_one(self.telegram.send))

        def interrupted(method, body):
            self.telegram.send(method, body)
            raise KeyboardInterrupt

        with self.assertRaises(KeyboardInterrupt):
            self.support.deliver_one(interrupted)
        self.configure_language_token()
        self.drain()
        menus = [body for method, body in self.telegram.calls if method == "setChatMenuButton"]
        self.assertEqual(len(menus), 2)
        self.assertEqual(menus[0], menus[1])
        self.assertEqual([m["text"] for m in self.telegram.received(REPORTER)],
                         ["Выберите язык", "English selected."])

    def test_language_without_signer_keeps_support_available_and_sends_general_launch(self):
        self.support.apply(self.message(text="/language"))
        self.drain()
        self.support.apply(self.press("English"))
        self.drain()
        response = self.telegram.last_text(REPORTER)
        self.assertIn("currently unavailable", response["text"])
        self.assertEqual(response["reply_markup"]["inline_keyboard"][0][0]["url"],
                         "https://t.me/InteriorsEditorBot?startapp")
        self.assertFalse(any(method == "setChatMenuButton" for method, _ in self.telegram.calls))
        self.restart()
        self.support.apply(self.message(text="/support"))
        self.drain()
        self.assertIn("screenshots", self.telegram.last_text(REPORTER)["text"])

    def test_support_notification_uses_the_owners_language_after_restart(self):
        self.support.apply(self.message(OWNER, "/help", language_code="en-GB"))
        self.drain()
        self.restart()
        ticket = self.send_ticket()
        self.assertIn("Report #", ticket["text"])
        self.assertIn(DESCRIPTION, ticket["text"])

    def test_english_ticket_receives_reply_in_english_from_russian_owner_after_restart(self):
        self.support.apply(self.message(text="/support", language_code="en-US"))
        self.drain()
        self.assertIn("screenshots", self.telegram.last_text(REPORTER)["text"])
        self.assertIn("https://domiknote.ru/legal/2026-11-24.2/en/telegram-support-privacy.html",
                      self.telegram.last_text(REPORTER)["text"])
        self.support.apply(self.message(text=DESCRIPTION, language_code="en-US"))
        self.drain()
        ticket = self.telegram.last_text(OWNER)
        self.assertIn(DESCRIPTION, ticket["text"])
        self.assertIn("was received", self.telegram.last_text(REPORTER)["text"])
        self.restart()
        self.support.apply(self.message(OWNER, REPLY, reply_to_message=ticket))
        self.drain()
        self.assertIn("Reply to report", self.telegram.last_text(REPORTER)["text"])
        self.assertIn(REPLY, self.telegram.last_text(REPORTER)["text"])

    def test_private_input_outside_support_shows_same_commands_as_help(self):
        self.support.apply(self.message(text="Где список команд?"))
        self.drain()
        hint = self.telegram.last_text(REPORTER)
        self.support.apply(self.message(text="/help"))
        self.drain()
        help_message = self.telegram.last_text(REPORTER)
        self.assertEqual(hint["text"], help_message["text"])
        self.assertEqual(hint["reply_markup"], help_message["reply_markup"])
        for command in ("/start", "/support", "/help"):
            self.assertIn(command, hint["text"])
        self.assertEqual(self.telegram.received(OWNER), [])

    def test_first_ordinary_send_after_disclosure_reaches_owner_without_button(self):
        self.support.apply(self.message(text="/support"))
        self.support.apply(self.message(text="Сообщение до инструкции."))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        introduction = self.telegram.received(REPORTER)[0]
        self.assertIn("обычной кнопкой Telegram", introduction["text"])
        self.assertIn("в личный чат", introduction["text"])
        self.assertFalse(introduction.get("reply_markup"))
        self.support.apply(self.message(text=DESCRIPTION))
        self.drain()
        receipt = self.telegram.last_text(REPORTER)["text"]
        ticket = self.telegram.last_text(OWNER)["text"]
        self.assertIn(DESCRIPTION, ticket)
        self.assertIn(ticket.splitlines()[0], receipt)
        self.assertIn("15 минут", receipt)
        self.support.apply(self.message(text="Постороннее сообщение после отправки."))
        self.drain()
        self.assertEqual(len(self.telegram.received(OWNER)), 1)
        self.assertIn("/help", self.telegram.last_text(REPORTER)["text"])

    def test_photos_before_and_after_standard_send_share_one_ticket_across_restart(self):
        self.support.apply(self.message(text="/support"))
        self.drain()
        self.support.apply(self.message(photo=[{"file_id": "before-text"}]))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        self.support.apply(self.message(text=DESCRIPTION))
        self.drain()
        ticket = self.telegram.last_text(OWNER)["text"].splitlines()[0]
        self.restart()
        self.support.apply(self.message(photo=[{"file_id": "after-text"}]))
        self.drain()
        photos = [message for message in self.telegram.received(OWNER) if "photo" in message]
        self.assertEqual([message["photo"] for message in photos], ["before-text", "after-text"])
        self.assertTrue(all(ticket.split("№", 1)[1] in message["caption"] for message in photos))
        self.support.apply(self.message(OWNER, REPLY, reply_to_message=photos[-1]))
        self.drain()
        self.assertIn(REPLY, self.telegram.last_text(REPORTER)["text"])
        self.clock.now += 15 * 60
        self.support.apply(self.message(photo=[{"file_id": "late"}]))
        self.drain()
        self.assertEqual([message["photo"] for message in self.telegram.received(OWNER)
                          if "photo" in message], ["before-text", "after-text"])
        self.assertIn("/help", self.telegram.last_text(REPORTER)["text"])

    def test_album_with_caption_submits_once_and_closing_photo_window_keeps_ticket(self):
        self.support.apply(self.message(text="/support"))
        self.drain()
        first = self.message(photo=[{"file_id": "album-0"}], caption=DESCRIPTION, media_group_id="album")
        self.assertTrue(self.support.apply(first))
        self.restart()
        self.assertFalse(self.support.apply(first))
        for photo in range(1, 6):
            self.support.apply(self.message(photo=[{"file_id": f"album-{photo}"}], media_group_id="album"))
        self.drain()
        messages = self.telegram.received(OWNER)
        self.assertEqual([message["photo"] for message in messages if "photo" in message],
                         [f"album-{photo}" for photo in range(5)])
        owner_ticket, = [message for message in messages if "text" in message]
        self.assertIn(DESCRIPTION, owner_ticket["text"])
        self.assertIn("максимальное число", self.telegram.last_text(REPORTER)["text"])

        self.support.apply(self.message(text="/cancel"))
        self.drain()
        self.assertIn("Приём фото к обращению закрыт", self.telegram.last_text(REPORTER)["text"])
        self.support.apply(self.message(photo=[{"file_id": "closed"}]))
        self.drain()
        self.assertIn("/help", self.telegram.last_text(REPORTER)["text"])
        self.assertEqual(self.telegram.received(OWNER), messages)
        self.support.apply(self.message(OWNER, REPLY, reply_to_message=owner_ticket))
        self.drain()
        self.assertIn(REPLY, self.telegram.last_text(REPORTER)["text"])

    def test_unacknowledged_intro_cannot_forward_text_until_support_is_reopened(self):
        self.telegram.error = ("sendMessage", REPORTER, DeliveryError("unknown", code="response-lost"))
        self.support.apply(self.message(text="/support"))
        self.drain()
        self.restart()
        self.support.apply(self.message(text=DESCRIPTION))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        self.assertIn("Дождитесь инструкции", self.telegram.last_text(REPORTER)["text"])
        self.send_ticket()
        self.assertIn(DESCRIPTION, self.telegram.last_text(OWNER)["text"])

    def test_photo_window_uses_sender_time_even_if_telegram_updates_arrive_late(self):
        self.support.apply(self.message(text="/support"))
        self.drain()
        sent_at = self.clock()
        description = self.message(text=DESCRIPTION)
        timely = self.message(photo=[{"file_id": "sent-in-window"}], date=sent_at + 15 * 60 - 1)
        late = self.message(photo=[{"file_id": "sent-too-late"}], date=sent_at + 15 * 60)
        self.clock.now += 60 * 60
        self.support.apply(description)
        self.support.apply(timely)
        self.support.apply(late)
        self.drain()
        self.assertEqual([message["photo"] for message in self.telegram.received(OWNER)
                          if "photo" in message], ["sent-in-window"])
        self.assertIn("/help", self.telegram.last_text(REPORTER)["text"])

    def test_rollback_replacement_draft_cannot_inherit_direct_send_permissions(self):
        self.support.apply(self.message(text="/support"))
        self.drain()
        with sqlite3.connect(self.db_path) as old:
            old.execute("DELETE FROM drafts WHERE chat_id = ?", (REPORTER,))
            old.execute("INSERT INTO drafts VALUES (?, ?, '', '[]', ?)",
                        (REPORTER, "0123456789abcdef", self.clock()))
        self.restart()
        self.support.apply(self.message(text=DESCRIPTION))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        self.support.apply(self.press("Отправить"))
        self.drain()
        self.assertIn(DESCRIPTION, self.telegram.last_text(OWNER)["text"])

    def test_legacy_cancel_after_rollback_ends_the_previous_photo_window(self):
        ticket = self.send_ticket()
        with sqlite3.connect(self.db_path) as old:
            old.execute("INSERT INTO drafts VALUES (?, ?, '', '[]', ?)",
                        (REPORTER, "0123456789abcdef", self.clock()))
        self.restart()
        self.support.apply(self.message(text="/support"))
        self.drain()
        self.support.apply(self.press("Отмена"))
        self.drain()
        self.support.apply(self.message(photo=[{"file_id": "after-cancel"}]))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [ticket])

    def test_caption_on_extra_photo_sends_description_and_only_first_five_photos(self):
        self.support.apply(self.message(text="/support"))
        self.drain()
        for index in range(5):
            self.support.apply(self.message(photo=[{"file_id": f"image-{index}"}]))
        self.support.apply(self.message(photo=[{"file_id": "extra"}], caption=DESCRIPTION))
        self.drain()
        self.assertIn(DESCRIPTION, self.telegram.last_text(OWNER)["text"])
        self.assertEqual([message["photo"] for message in self.telegram.received(OWNER)
                          if "photo" in message], [f"image-{index}" for index in range(5)])

    def test_reporter_sends_text_and_photo_and_only_reporter_gets_owner_reply(self):
        self.support.apply(self.message(text="/support"))
        self.drain()
        screenshot = self.message(photo=[
            {"file_id": "telegram-thumbnail", "file_unique_id": "thumb", "width": 32, "height": 32},
            {"file_id": SCREENSHOT, "file_unique_id": "full", "width": 800, "height": 600},
        ])
        self.assertTrue(self.support.apply(screenshot))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
        self.assertTrue(self.support.apply(self.message(text=DESCRIPTION)))
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

    def test_preupgrade_draft_waits_for_legacy_button_and_two_clicks_submit_once(self):
        with sqlite3.connect(self.db_path) as old:
            old.execute("INSERT INTO drafts VALUES (?, ?, ?, '[]', ?)",
                        (REPORTER, "0123456789abcdef", "Черновик до обновления.", self.clock()))
        self.restart()
        start = self.message(text="/support")
        self.assertFalse(self.support.apply({"message": start["message"]}))
        self.assertTrue(self.support.apply(start))
        self.assertFalse(self.support.apply(start))
        self.drain()
        self.assertTrue(self.support.apply(self.message(text=DESCRIPTION)))
        self.drain()
        self.assertEqual(self.telegram.received(OWNER), [])
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

    def test_cancelled_or_expired_draft_leaves_text_in_help_mode(self):
        self.support.apply(self.message(text="/support"))
        self.drain()
        self.support.apply(self.message(photo=[{"file_id": "cancelled"}]))
        self.assertTrue(self.support.apply(self.message(text="/cancel")))
        self.drain()
        self.assertIn("отменён", self.telegram.last_text(REPORTER)["text"])
        self.support.apply(self.message(text=DESCRIPTION))
        self.drain()
        self.assertIn("/support", self.telegram.last_text(REPORTER)["text"])
        self.assertEqual(self.telegram.received(OWNER), [])

        self.support.apply(self.message(text="/support"))
        self.drain()
        self.clock.now += 24 * 60 * 60
        self.assertTrue(self.support.apply(self.message(text="Сообщение после истечения.")))
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
        self.assertEqual(self.telegram.received(OWNER), [])

        self.assertTrue(self.support.apply(self.message(text=DESCRIPTION)))
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
        self.assertEqual(self.telegram.received(OWNER), [])
        self.support.apply(self.message(text=description))
        self.drain()
        self.assertIn(description, self.telegram.last_text(OWNER)["text"])
        self.assertFalse(any(message.get("photo") for message in self.telegram.received(OWNER)))

    def test_owner_delivery_retries_only_after_retry_after_across_restart(self):
        self.add_description()
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
