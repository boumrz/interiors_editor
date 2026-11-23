#!/usr/bin/env python3
"""Restricted SSH ForceCommand for a verified Telegram release."""
import hashlib
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile

MAX_ARCHIVE_BYTES = 300 * 1024 * 1024
DEPLOY_DIRECTORY = Path(__file__).resolve().parent
INCOMING = Path("/opt/interiors-editor/deploy/incoming")


def parse_command(command):
    match = re.fullmatch(r"deploy-telegram ([0-9a-f]{40}) ([0-9a-f]{64}) ([1-9][0-9]{0,9})", command)
    if not match or int(match[3]) > MAX_ARCHIVE_BYTES:
        raise ValueError("Only the bounded Telegram deploy protocol is accepted")
    return match[1], match[2], int(match[3])


def receive(stream, destination, expected_digest, expected_size):
    digest = hashlib.sha256()
    received = 0
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as output:
        while received <= expected_size:
            block = stream.read(min(1024 * 1024, expected_size - received + 1))
            if not block:
                break
            received += len(block)
            if received > expected_size:
                raise ValueError("Archive exceeds its declared length")
            output.write(block)
            digest.update(block)
    if received != expected_size or digest.hexdigest() != expected_digest:
        raise ValueError("Archive length or SHA-256 mismatch")


def activate_archive(archive, commit):
    process = subprocess.Popen([
        "/usr/bin/python3", str(DEPLOY_DIRECTORY / "frontend.py"), "activate-telegram",
        "--archive", str(archive), "--commit", commit,
    ], env={"PATH": "/usr/sbin:/usr/bin:/sbin:/bin"})
    try:
        status = process.wait(timeout=900)
    except subprocess.TimeoutExpired:
        # The frontend transaction handles SIGTERM through its rollback path.
        process.terminate()
        try:
            process.wait(timeout=120)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        raise
    if status:
        raise subprocess.CalledProcessError(status, "Telegram activation")


def main():
    commit, digest, size = parse_command(os.environ.get("SSH_ORIGINAL_COMMAND", ""))
    # A stalled sender must not retain a root process indefinitely.
    signal.alarm(600)
    incoming = INCOMING
    incoming.mkdir(mode=0o700, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="github-", dir=incoming) as directory:
        archive = Path(directory) / "telegram.tar.gz"
        receive(sys.stdin.buffer, archive, digest, size)
        signal.alarm(1080)
        activate_archive(archive, commit)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(f"Telegram deployment refused: {error}", file=sys.stderr)
        sys.exit(1)
