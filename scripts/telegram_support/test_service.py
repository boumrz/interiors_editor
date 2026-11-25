import contextlib
import io
import json
from pathlib import Path
from types import SimpleNamespace
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch

from . import service
from .service import (
    DEFAULT_CONFIG,
    EXPECTED_BOT_ID,
    EXPECTED_BOT_USERNAME,
    OpsError,
    Poller,
    bind_owner,
    check_bot,
    main,
    poll_lock,
    run_worker,
)
from .support import DeliveryError, Support
from .telegram_api import TelegramApi


HERE = Path(__file__).parent
TOKEN = f"{EXPECTED_BOT_ID}:" + "x" * 35


class Response:
    def __init__(self, status, body):
        self.status = status
        self.body = body

    def read(self, count):
        return self.body[:count]


class Connection:
    def __init__(self, response=None, *, fail_connect=False, fail_request=False):
        self.response = response
        self.fail_connect = fail_connect
        self.fail_request = fail_request
        self.requests = []
        self.closed = False

    def connect(self):
        if self.fail_connect:
            raise OSError("sensitive transport detail")

    def request(self, method, path, *, body, headers):
        self.requests.append((method, path, json.loads(body), headers))
        if self.fail_request:
            raise OSError("sensitive transport detail")

    def getresponse(self):
        return self.response

    def close(self):
        self.closed = True


def envelope(status, **body):
    return Response(status, json.dumps(body).encode())


class Api:
    def __init__(self, **methods):
        self.methods = methods
        self.calls = []

    def call(self, method, parameters=None, *, timeout=10):
        self.calls.append((method, parameters, timeout))
        result = self.methods[method]
        if callable(result):
            return result()
        return result


def update(update_id, *, sender=21, chat=21, chat_type="private", text="/start",
           is_bot=False):
    return {"update_id": update_id, "message": {
        "text": text, "from": {"id": sender, "is_bot": is_bot},
        "chat": {"id": chat, "type": chat_type},
    }}


class TelegramApiTests(unittest.TestCase):
    def make_api(self, connection):
        created = []

        def factory(host, *, timeout):
            created.append((host, timeout))
            return connection

        return TelegramApi(TOKEN, connection_factory=factory), created

    def test_posts_json_to_expected_host_and_closes_connection(self):
        connection = Connection(envelope(200, ok=True, result={"message_id": 12}))
        api, created = self.make_api(connection)

        result = api.call("sendMessage", {"chat_id": 16, "text": "Проверка"}, timeout=15)

        self.assertEqual(result, {"message_id": 12})
        self.assertEqual(created, [("api.telegram.org", 15)])
        self.assertEqual(connection.requests, [("POST", f"/bot{TOKEN}/sendMessage",
                                                {"chat_id": 16, "text": "Проверка"},
                                                {"Content-Type": "application/json"})])
        self.assertTrue(connection.closed)

    def test_rejects_an_invalid_method_before_network(self):
        api, created = self.make_api(Connection())
        with self.assertRaises(ValueError):
            api.call("../sendMessage")
        self.assertEqual(created, [])

    def test_differentiates_retryable_rejected_and_uncertain_failures(self):
        cases = [
            (Connection(fail_connect=True), "retry", 0, "offline"),
            (Connection(fail_request=True), "unknown", 0, "transport-unknown"),
            (Connection(envelope(429, ok=False, error_code=429,
                                 parameters={"retry_after": 137})), "retry", 137, "rate-limited"),
            (Connection(envelope(429, ok=False, error_code=429,
                                 parameters={"retry_after": False})), "retry", 30, "rate-limited"),
            (Connection(envelope(400, ok=False, error_code=400,
                                 description="private input")), "rejected", 0, "bad-request"),
            (Connection(envelope(403, ok=False, error_code=403)), "rejected", 0, "forbidden"),
            (Connection(envelope(409, ok=False, error_code=409)), "rejected", 0, "poll-conflict"),
            (Connection(envelope(503, ok=False, error_code=503)), "unknown", 0, "gateway-unknown"),
            (Connection(Response(200, b"not JSON")), "unknown", 0, "invalid-response"),
            (Connection(envelope(200, ok=True)), "unknown", 0, "invalid-response"),
            (Connection(Response(302, b"redirect")), "unknown", 0, "gateway-unknown"),
            (Connection(Response(200, b" " * (2 * 1024 * 1024 + 1))),
             "unknown", 0, "invalid-response"),
        ]
        for connection, kind, delay, code in cases:
            with self.subTest(code=code, kind=kind, delay=delay):
                api, _ = self.make_api(connection)
                with self.assertRaises(DeliveryError) as failed:
                    api.call("sendMessage", {"text": "private input"})
                self.assertEqual((failed.exception.kind, failed.exception.delay,
                                  failed.exception.code), (kind, delay, code))
                self.assertNotIn(TOKEN, str(failed.exception))
                self.assertNotIn("private input", str(failed.exception))
                self.assertNotIn("sensitive", str(failed.exception))
                self.assertTrue(connection.closed)


class PreflightTests(unittest.TestCase):
    def test_confirms_identity_and_rejects_any_existing_webhook(self):
        bot = {"id": EXPECTED_BOT_ID, "username": EXPECTED_BOT_USERNAME.upper(), "is_bot": True}
        api = Api(getMe=bot, getWebhookInfo={"url": ""})
        check_bot(api)
        self.assertEqual([method for method, _, _ in api.calls], ["getMe", "getWebhookInfo"])

        for url in ["https://irrelevant.example/private-path", None]:
            with self.subTest(url=url):
                with self.assertRaisesRegex(OpsError, "webhook"):
                    check_bot(Api(getMe=bot, getWebhookInfo={"url": url}))

        for incorrect in [{"id": EXPECTED_BOT_ID + 1}, {"username": "other"}, {"is_bot": False}]:
            api = Api(getMe=bot | incorrect)
            with self.subTest(incorrect=incorrect):
                with self.assertRaisesRegex(OpsError, "identity"):
                    check_bot(api)
                self.assertEqual([method for method, _, _ in api.calls], ["getMe"])


class PollerTests(unittest.TestCase):
    def test_offset_confirms_only_committed_updates_and_resets_on_empty(self):
        batches = iter([[update(8), update(5)], [], [update(2)], []])
        api = Api(getUpdates=lambda: next(batches))
        committed = []
        poller = Poller(api, lambda item: committed.append(item["update_id"]))

        for _ in range(4):
            poller.poll(timeout=3)

        self.assertEqual(committed, [5, 8, 2])
        self.assertEqual([payload.get("offset") for _, payload, _ in api.calls],
                         [None, 9, None, 3])
        self.assertTrue(all(payload["allowed_updates"] == ["message", "callback_query"]
                            for _, payload, _ in api.calls))

    def test_uncommitted_batch_or_transport_error_resets_offset(self):
        def refuse_update(item):
            if item["update_id"] == 4:
                raise RuntimeError("database write failed")
            committed.append(item["update_id"])

        def fetch():
            batch = next(batches)
            if isinstance(batch, Exception):
                raise batch
            return batch

        batches = iter([[update(2)], [update(3), update(4)], [update(5)],
                        DeliveryError("unknown", code="transport-unknown"), [update(6)]])
        api = Api(getUpdates=fetch)
        committed = []
        poller = Poller(api, refuse_update)

        poller.poll()
        with self.assertRaises(RuntimeError):
            poller.poll()
        poller.poll()
        with self.assertRaises(DeliveryError):
            poller.poll()
        poller.poll()

        self.assertEqual(committed, [2, 3, 5, 6])
        self.assertEqual([payload.get("offset") for _, payload, _ in api.calls],
                         [None, 3, None, 6, None])

    def test_malformed_batch_is_left_unconfirmed(self):
        batches = iter([[update(10)], [{"update_id": True}], [update(3)]])
        api = Api(getUpdates=lambda: next(batches))
        committed = []
        poller = Poller(api, lambda item: committed.append(item["update_id"]))

        poller.poll()
        with self.assertRaises(DeliveryError):
            poller.poll()
        poller.poll()

        self.assertEqual(committed, [10, 3])
        self.assertEqual([payload.get("offset") for _, payload, _ in api.calls], [None, 11, None])

    def test_worker_honors_retry_after_and_stops_on_second_poller(self):
        failures = iter([DeliveryError("retry", delay=10, code="rate-limited"),
                         DeliveryError("rejected", code="poll-conflict")])

        def fetch():
            raise next(failures)

        api = Api(getUpdates=fetch)
        waits = []

        class Store:
            def __init__(self):
                self.delivered = []

            def deliver_one(self, send):
                self.delivered.append(send)
                return False

            def apply(self, item):
                raise AssertionError("No updates expected")

        store = Store()
        with self.assertRaisesRegex(OpsError, "poll-conflict"):
            run_worker(api, store, stopping=lambda: False, wait=waits.append)
        self.assertEqual(waits, [10])
        self.assertEqual(store.delivered, [api.call, api.call])


class OwnerBindingTests(unittest.TestCase):
    def test_accepts_only_matching_human_private_chat_and_never_advances_queue(self):
        command = "/start support_bind_test-fixture"
        records = [update(1, sender=25, chat=21, text=command),
                   update(2, sender=25, chat=25, chat_type="group", text=command),
                   update(3, sender=25, chat=25, text=command, is_bot=True),
                   update(4, text=f"{command}-wrong"), update(5, text=command)]
        api = Api(getUpdates=records)
        waits = []

        owner = bind_owner(api, command, clock=lambda: 0, wait=waits.append)

        self.assertEqual(owner, 21)
        self.assertEqual(waits, [])
        self.assertEqual([method for method, _, _ in api.calls], ["getUpdates"])
        self.assertNotIn("offset", api.calls[0][1])

    def test_rejects_ambiguous_ownership_full_queue_and_timeout(self):
        command = "/start support_bind_test-fixture"
        for records, code in [
            ([update(1, text=command), update(2, sender=25, chat=25, text=command)],
             "owner-ambiguous"),
            ([update(i) for i in range(1, 101)], "owner-bind-backlog-full"),
        ]:
            with self.subTest(code=code):
                api = Api(getUpdates=records)
                with self.assertRaisesRegex(OpsError, code):
                    bind_owner(api, command, clock=lambda: 0)
                self.assertNotIn("offset", api.calls[0][1])
        times = iter([1, 301])
        with self.assertRaisesRegex(OpsError, "owner-bind-timeout"):
            bind_owner(Api(getUpdates=[]), command, clock=lambda: next(times), wait=lambda _: None)

    def test_second_local_poller_cannot_obtain_same_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            lock = Path(directory) / "poll.lock"
            with poll_lock(lock):
                with self.assertRaisesRegex(OpsError, "poller-already-running"):
                    with poll_lock(lock):
                        self.fail("An active consumer already holds the lock")
            with poll_lock(lock):
                self.assertTrue(lock.is_file())


class OperationTests(unittest.TestCase):
    def test_language_credential_signs_the_same_account_bound_vector_as_the_editor(self):
        # RFC 8032 test key, never used by the running bot.
        key = bytes.fromhex("302e020100300506032b657004220420"
                            "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            self.assertIsNone(service.read_language_token(config))
            file = config / "interiors-telegram-language-key"
            pem = subprocess.run(["openssl", "pkey", "-inform", "DER", "-outform", "PEM"],
                                 input=key, capture_output=True, check=True).stdout
            file.write_bytes(pem)
            file.chmod(0o600)
            token = service.read_language_token(config)
            self.assertEqual(token(410002, "en", 3),
                             "lang1_en_3_OBb2b1eaEuYS4XY7ZTwGyeG0RUVEGSFiityH78dCxdw-"
                             "xcr7tOYFoxkaxOeQNf04MAP5U_CdM3d68IZ6hT3nCA")
            self.assertNotEqual(token(410003, "en", 3), token(410002, "en", 3))
            file.chmod(0o644)
            with self.assertRaisesRegex(OpsError, "credential-permissions"):
                service.read_language_token(config)

    def test_language_credential_rejects_a_non_signing_key(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            file = config / "interiors-telegram-language-key"
            subprocess.run(["openssl", "genpkey", "-algorithm", "X25519", "-out", str(file)],
                           capture_output=True, check=True)
            file.chmod(0o600)
            with self.assertRaisesRegex(OpsError, "invalid-language-signing-key"):
                service.read_language_token(config)

    def test_publish_commands_updates_only_private_chat_commands_in_both_languages(self):
        bot = {"id": EXPECTED_BOT_ID, "username": EXPECTED_BOT_USERNAME, "is_bot": True}
        api = Api(getMe=bot, getWebhookInfo={"url": ""}, setMyCommands=True)
        stdout = io.StringIO()
        with (patch.object(service, "read_api", return_value=api), contextlib.redirect_stdout(stdout)):
            self.assertEqual(main(["publish-commands"]), 0)
        self.assertEqual(json.loads(stdout.getvalue()), {"commands_published": True})
        english, russian = [body for method, body, _ in api.calls if method == "setMyCommands"]
        self.assertEqual(english["language_code"], "")
        self.assertEqual(russian["language_code"], "ru")
        for body, description in ((english, "Change language"), (russian, "Изменить язык")):
            self.assertEqual(body["scope"], {"type": "all_private_chats"})
            self.assertIn({"command": "language", "description": description}, body["commands"])

    def test_only_systemd_credential_directory_accepts_readable_root_group(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            token = path / "bot-token"
            token.write_text(TOKEN, encoding="ascii")
            token.chmod(0o440)
            info = SimpleNamespace(st_mode=token.stat().st_mode, st_uid=0, st_gid=0)
            with patch.object(service.os, "fstat", return_value=info):
                with self.assertRaisesRegex(OpsError, "credential-permissions"):
                    service.read_credential(path, "bot-token")
                with patch.object(service, "SYSTEMD_CREDENTIALS", path):
                    self.assertEqual(service.read_credential(path, "bot-token"), TOKEN)
                    for mode, uid, gid in [(0o444, 0, 0), (0o460, 0, 0), (0o440, 1, 0), (0o440, 0, 1)]:
                        with self.subTest(mode=mode, uid=uid, gid=gid):
                            info.st_mode = (info.st_mode & ~0o777) | mode
                            info.st_uid, info.st_gid = uid, gid
                            with self.assertRaisesRegex(OpsError, "credential-permissions"):
                                service.read_credential(path, "bot-token")

    def test_missing_and_public_credentials_fail_quietly_and_safely(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            stdout, stderr = io.StringIO(), io.StringIO()
            command = ["--config-dir", directory, "check"]
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                self.assertEqual(main(command), 78)
                token = config / "bot-token"
                token.write_text(TOKEN, encoding="ascii")
                token.chmod(0o644)
                self.assertEqual(main(command), 78)
            self.assertEqual(stdout.getvalue(), "")
            self.assertIn("credential-missing", stderr.getvalue())
            self.assertIn("credential-permissions", stderr.getvalue())
            self.assertNotIn(TOKEN, stderr.getvalue())

    def test_binding_writes_private_once_and_preserves_activation_on_repeat(self):
        challenge = "/start support_bind_fixture"
        bot = {"id": EXPECTED_BOT_ID, "username": EXPECTED_BOT_USERNAME, "is_bot": True}
        api = Api(getMe=bot, getWebhookInfo={"url": ""}, getUpdates=[update(1, text=challenge)])
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory)
            stdout = io.StringIO()
            stderr = io.StringIO()
            args = ["--config-dir", directory, "--state-dir", directory, "bind-owner"]
            with (patch.object(service, "read_api", return_value=api),
                  patch.object(service.secrets, "token_urlsafe", return_value="fixture"),
                  contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr)):
                self.assertEqual(main(args), 0)
                activation = (config / "accept-from").read_text()
                self.assertEqual(main(args), 78)
            self.assertEqual(json.loads(stdout.getvalue()), {"owner_bound": True})
            self.assertIn(challenge, stderr.getvalue())
            self.assertIn("owner-already-bound", stderr.getvalue())
            self.assertEqual((config / "owner-chat-id").read_text(), "21\n")
            self.assertEqual((config / "accept-from").read_text(), activation)
            self.assertTrue(activation.strip().isdigit())
            for name in ("owner-chat-id", "accept-from"):
                self.assertEqual((config / name).stat().st_mode & 0o777, 0o600)
            self.assertEqual([name for name, _, _ in api.calls],
                             ["getMe", "getWebhookInfo", "getUpdates"])

    def test_status_does_not_reconcile_a_delivery_in_progress(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            for name, value in [("owner-chat-id", 21), ("accept-from", int(time.time()) - 5)]:
                (path / name).write_text(f"{value}\n")
                (path / name).chmod(0o600)
            store = Support(path / "support.sqlite3", 21)
            self.addCleanup(store.close)
            store.apply(update(1))
            args = ["--config-dir", directory, "--state-dir", directory, "status"]

            def send(method, parameters):
                stdout = io.StringIO()
                with contextlib.redirect_stdout(stdout):
                    self.assertEqual(main(args), 0)
                self.assertEqual(json.loads(stdout.getvalue()),
                                 {"counts": {"sending": 1}, "unresolved": []})
                return {"message_id": 1}

            self.assertTrue(store.deliver_one(send))
            self.assertEqual(store.summary(), {"counts": {}, "unresolved": []})

    def test_install_stage_is_inactive_private_and_repeatable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            command = ["sh", str(HERE / "install.sh"), "--stage", directory]
            for _ in range(2):
                subprocess.run(command, check=True, capture_output=True)
            lib = root / "usr/local/lib/interiors-telegram-support/current"
            self.assertTrue(lib.is_symlink())
            self.assertTrue(all((lib / name).is_file() for name in
                                ("service.py", "support.py", "telegram_api.py", "messages.py")))
            self.assertEqual((root / str(DEFAULT_CONFIG).strip("/")).stat().st_mode & 0o777,
                             0o700)
            self.assertFalse((root / str(DEFAULT_CONFIG).strip("/") / "bot-token").exists())
            self.assertFalse((root / "etc/systemd/system/multi-user.target.wants").exists())
            unit = root / "etc/systemd/system/interiors-telegram-support.service"
            content = unit.read_text()
            self.assertIn("LoadCredential=bot-token:", content)
            self.assertIn("LoadCredential=owner-chat-id:", content)
            self.assertIn("LoadCredential=interiors-telegram-language-key\n", content)
            self.assertIn("LoadCredential=accept-from:", content)
            self.assertIn("ProtectSystem=strict", content)
            self.assertIn("LimitCORE=0", content)
            self.assertNotIn("EnvironmentFile", content)


if __name__ == "__main__":
    unittest.main()
