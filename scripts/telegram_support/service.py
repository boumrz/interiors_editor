#!/usr/bin/env python3
"""Operate the single Telegram support worker without logging message data."""
import argparse
from base64 import urlsafe_b64encode
from contextlib import contextmanager
import fcntl
from hashlib import sha256
import json
import os
from pathlib import Path
import pwd
import re
import secrets
import signal
import stat
import subprocess
import sys
import tempfile
import threading
import time

if __package__:
    from .messages import bot_commands
    from .support import DeliveryError, Support
    from .telegram_api import TelegramApi
else:
    from messages import bot_commands
    from support import DeliveryError, Support
    from telegram_api import TelegramApi


EXPECTED_BOT_ID = 9112733311
EXPECTED_BOT_USERNAME = "InteriorsEditorBot"
SERVICE_USER = "interiors-telegram-support"
DEFAULT_CONFIG = Path("/etc/interiors-editor/telegram-support")
DEFAULT_STATE = Path("/var/lib/interiors-telegram-support")
SYSTEMD_CREDENTIALS = Path("/run/credentials/interiors-telegram-support.service")
LANGUAGE_CREDENTIAL = "interiors-telegram-language-key"
UPDATE_LIMIT = 100
LONG_POLL_SECONDS = 12
BIND_SECONDS = 300
MAX_DRAIN = 20


class OpsError(Exception):
    """A stable operator-facing error code with no credentials or message data."""


def check_bot(api):
    bot = api.call("getMe")
    if (not isinstance(bot, dict) or type(bot.get("id")) is not int
            or bot["id"] != EXPECTED_BOT_ID
            or bot.get("is_bot") is not True
            or not isinstance(bot.get("username"), str)
            or bot["username"].casefold() != EXPECTED_BOT_USERNAME.casefold()):
        raise OpsError("unexpected-bot-identity")
    webhook = api.call("getWebhookInfo")
    if not isinstance(webhook, dict) or webhook.get("url") != "":
        raise OpsError("webhook-present-or-unverifiable")


def publish_commands(api):
    check_bot(api)
    for language_code in ("", "ru"):
        if api.call("setMyCommands", {
            "scope": {"type": "all_private_chats"},
            "language_code": language_code,
            "commands": bot_commands(language_code),
        }) is not True:
            raise OpsError("bot-commands-not-published")


def get_updates(api, *, timeout, offset=None):
    request = {"timeout": timeout, "limit": UPDATE_LIMIT,
               "allowed_updates": ["message", "callback_query"]}
    if offset is not None:
        request["offset"] = offset
    updates = api.call("getUpdates", request, timeout=timeout + 8)
    if (not isinstance(updates, list) or len(updates) > UPDATE_LIMIT
            or any(not isinstance(update, dict) or type(update.get("update_id")) is not int
                   or not 0 < update["update_id"] < 2**63 - 1 for update in updates)):
        raise DeliveryError("unknown", code="invalid-update-batch")
    return sorted(updates, key=lambda update: update["update_id"])


class Poller:
    def __init__(self, api, apply):
        self.api = api
        self.apply = apply
        self.offset = None

    def poll(self, *, timeout=LONG_POLL_SECONDS):
        offset, self.offset = self.offset, None
        updates = get_updates(self.api, timeout=timeout, offset=offset)
        for update in updates:
            self.apply(update)
        if updates:
            self.offset = updates[-1]["update_id"] + 1


def run_worker(api, support, *, stopping, wait):
    poller = Poller(api, support.apply)
    while not stopping():
        timeout = LONG_POLL_SECONDS
        for _ in range(MAX_DRAIN):
            if stopping():
                return
            if not support.deliver_one(api.call):
                break
        else:
            # Bound any one stretch of outbox work without starving inbound messages.
            timeout = 0
        if stopping():
            return
        try:
            poller.poll(timeout=timeout)
        except DeliveryError as error:
            if error.kind == "rejected":
                raise OpsError(error.code) from None
            wait(error.delay or 3)


def owner_from_update(update, challenge):
    message = update.get("message")
    if not isinstance(message, dict) or message.get("text") != challenge:
        return None
    sender = message.get("from")
    chat = message.get("chat")
    if not isinstance(sender, dict) or not isinstance(chat, dict):
        return None
    sender_id = sender.get("id")
    if (type(sender_id) is int and 0 < sender_id < 2**52
            and sender.get("is_bot") is False and chat.get("type") == "private"
            and type(chat.get("id")) is int and chat["id"] == sender_id):
        return sender_id
    return None


def bind_owner(api, challenge, *, clock=time.monotonic, wait=time.sleep):
    deadline = clock() + BIND_SECONDS
    while clock() < deadline:
        updates = get_updates(api, timeout=0)
        owners = {owner for update in updates
                  if (owner := owner_from_update(update, challenge)) is not None}
        if len(owners) > 1:
            raise OpsError("owner-ambiguous")
        if owners:
            return owners.pop()
        if len(updates) == UPDATE_LIMIT:
            raise OpsError("owner-bind-backlog-full")
        wait(1)
    raise OpsError("owner-bind-timeout")


@contextmanager
def poll_lock(path):
    descriptor = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise OpsError("poller-already-running") from None
        yield
    finally:
        os.close(descriptor)


def read_credential(directory, name):
    try:
        descriptor = os.open(directory / name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except FileNotFoundError:
        raise OpsError("credential-missing") from None
    except OSError:
        raise OpsError("credential-unreadable") from None
    with os.fdopen(descriptor, "rb") as stream:
        info = os.fstat(stream.fileno())
        mode = stat.S_IMODE(info.st_mode)
        # systemd grants the worker read access through an ACL whose mask shows as group-read.
        systemd_copy = (directory == SYSTEMD_CREDENTIALS and mode == 0o440
                        and info.st_uid == info.st_gid == 0)
        if not stat.S_ISREG(info.st_mode) or (mode & 0o077 and not systemd_copy):
            raise OpsError("credential-permissions")
        try:
            return stream.read(256).decode("ascii").strip()
        except (OSError, UnicodeError):
            raise OpsError("credential-unreadable") from None


def write_credential(directory, name, value):
    with tempfile.NamedTemporaryFile(dir=directory, mode="w", encoding="ascii") as stream:
        stream.write(f"{value}\n")
        stream.flush()
        os.fsync(stream.fileno())
        try:
            os.link(stream.name, directory / name)
        except FileExistsError:
            raise OpsError("credential-already-present") from None


def positive_integer(raw, upper_bound, error):
    if not re.fullmatch(r"[1-9][0-9]{0,18}", raw) or int(raw) >= upper_bound:
        raise OpsError(error)
    return int(raw)


def read_owner(config):
    return positive_integer(read_credential(config, "owner-chat-id"), 2**52, "invalid-owner")


def read_activation(config):
    return positive_integer(read_credential(config, "accept-from"),
                            int(time.time()) + 301, "invalid-activation-time")


def read_api(config):
    token = read_credential(config, "bot-token")
    if not token.startswith(f"{EXPECTED_BOT_ID}:"):
        raise OpsError("invalid-bot-token")
    return TelegramApi(token)


def read_language_token(config):
    try:
        read_credential(config, LANGUAGE_CREDENTIAL)
    except OpsError as error:
        if str(error) == "credential-missing":
            return None
        raise
    key_path = str(config / LANGUAGE_CREDENTIAL)
    try:
        public_key = subprocess.run(
            ["openssl", "pkey", "-in", key_path, "-passin", "pass:", "-pubout", "-outform", "DER"],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            timeout=2, check=True,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        raise OpsError("invalid-language-signing-key") from None
    # Ed25519 SubjectPublicKeyInfo has this algorithm identifier and 32 raw bytes.
    ed25519_prefix = bytes.fromhex("302a300506032b6570032100")
    if len(public_key) != len(ed25519_prefix) + 32 or not public_key.startswith(ed25519_prefix):
        raise OpsError("invalid-language-signing-key")

    def language_token(chat_id, language, revision):
        digest = sha256(f"tma-v1:production:{EXPECTED_BOT_ID}:{chat_id}".encode()).hexdigest()
        payload = f"interiors-language/1\ntma-v1-{digest}\n{language}\n{revision}".encode()
        try:
            # OpenSSL Ed25519 requires a seekable input of known length.
            with tempfile.NamedTemporaryFile() as source:
                source.write(payload)
                source.flush()
                result = subprocess.run(
                    ["openssl", "pkeyutl", "-sign", "-rawin", "-inkey", key_path, "-passin", "pass:",
                     "-in", source.name],
                    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                    timeout=2, check=True,
                )
        except (OSError, subprocess.SubprocessError):
            return None
        if len(result.stdout) != 64:
            return None
        signature = urlsafe_b64encode(result.stdout).decode("ascii").rstrip("=")
        return f"lang1_{language}_{revision}_{signature}"

    return language_token


def bind_configured_owner(config, state):
    if (config / "owner-chat-id").exists():
        raise OpsError("owner-already-bound")
    api = read_api(config)
    with poll_lock(state / "poll.lock"):
        check_bot(api)
        challenge = "/start support_bind_" + secrets.token_urlsafe(18)
        print(f"Отправьте эту команду в личном чате с @{EXPECTED_BOT_USERNAME}:\n{challenge}",
              file=sys.stderr, flush=True)
        owner = bind_owner(api, challenge)
        if not (config / "accept-from").exists():
            write_credential(config, "accept-from", int(time.time()))
        read_activation(config)
        write_credential(config, "owner-chat-id", owner)


def drop_admin_privileges(state):
    if os.geteuid() == 0 and state == DEFAULT_STATE:
        try:
            worker = pwd.getpwnam(SERVICE_USER)
        except KeyError:
            raise OpsError("service-user-missing") from None
        os.setgroups([])
        os.setgid(worker.pw_gid)
        os.setuid(worker.pw_uid)


def run_service(config, state):
    api = read_api(config)
    owner = read_owner(config)
    activation = read_activation(config)
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    with poll_lock(state / "poll.lock"):
        check_bot(api)
        try:
            language_token = read_language_token(config)
        except OpsError:
            print("language-signing-credential-unavailable", file=sys.stderr)
            language_token = None
        support = Support(state / "support.sqlite3", owner, bot_started_at=activation,
                          language_token=language_token)
        try:
            run_worker(api, support, stopping=stop.is_set, wait=stop.wait)
        finally:
            support.close()


def admin_action(action, argument, config, state):
    owner = read_owner(config)
    activation = read_activation(config)
    job = positive_integer(argument, 2**63, "invalid-job") if action == "retry-uncertain" else None
    drop_admin_privileges(state)
    database = state / "support.sqlite3"
    if not database.is_file():
        raise OpsError("support-not-started")
    support = Support(database, owner, bot_started_at=activation, recover_inflight=False)
    try:
        if action == "status":
            return support.summary()
        if not support.retry_uncertain(job):
            raise OpsError("job-not-uncertain")
        return {"retry_queued": True}
    finally:
        support.close()


def main(arguments=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config-dir", type=Path,
                        default=Path(os.environ.get("CREDENTIALS_DIRECTORY", DEFAULT_CONFIG)))
    parser.add_argument("--state-dir", type=Path, default=DEFAULT_STATE)
    commands = parser.add_subparsers(dest="action", required=True)
    for command in ("check", "bind-owner", "run", "status", "publish-commands"):
        commands.add_parser(command)
    commands.add_parser("retry-uncertain").add_argument("job")
    args = parser.parse_args(arguments)
    try:
        if args.action == "check":
            check_bot(read_api(args.config_dir))
            result = {"identity_verified": True, "webhook": False}
        elif args.action == "bind-owner":
            bind_configured_owner(args.config_dir, args.state_dir)
            result = {"owner_bound": True}
        elif args.action == "run":
            run_service(args.config_dir, args.state_dir)
            return 0
        elif args.action == "publish-commands":
            publish_commands(read_api(args.config_dir))
            result = {"commands_published": True}
        else:
            result = admin_action(args.action, getattr(args, "job", None),
                                  args.config_dir, args.state_dir)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except OpsError as error:
        print(str(error), file=sys.stderr)
        return 78
    except DeliveryError as error:
        print(error.code, file=sys.stderr)
        return 78 if error.kind == "rejected" else 1
    except Exception:
        # Tracebacks can contain Telegram payloads or paths derived from credentials.
        print("support-operation-failed", file=sys.stderr)
        return 1


if __name__ == "__main__":
    os.umask(0o077)
    raise SystemExit(main())
