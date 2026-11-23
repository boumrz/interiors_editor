import hashlib
import importlib.util
import io
from pathlib import Path
import os
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
import subprocess


spec = importlib.util.spec_from_file_location("receiver", Path(__file__).with_name("receiver.py"))
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)


class ReceiverTests(unittest.TestCase):
    def test_accepts_only_exact_bounded_telegram_deploy_protocol(self):
        commit, digest = "a" * 40, "b" * 64
        limit = 300 * 1024 * 1024
        for size in (1, 123, limit):
            self.assertEqual(receiver.parse_command(f"deploy-telegram {commit} {digest} {size}"), (commit, digest, size))
        for command in ["", "bash", f"deploy {commit} {digest} 1", f"deploy-telegram {commit} {digest} 0",
                        f"deploy-telegram {commit} {digest} {limit + 1}", f"deploy-telegram {commit} {digest} 01",
                        f"deploy-telegram {commit} {digest} 1 extra", f"deploy-telegram {commit} {digest} 1\n",
                        f"deploy-telegram {'A' * 40} {digest} 1", f"deploy-telegram {commit} {digest.upper()} 1",
                        f"deploy-telegram {commit[:-1]} {digest} 1", f"deploy-telegram {commit} {digest[:-1]} 1",
                        f"deploy-telegram {commit} {digest} -1"]:
            with self.subTest(command=command), self.assertRaises(ValueError):
                receiver.parse_command(command)

    def test_forced_receiver_rejects_legacy_command_before_staging(self):
        with tempfile.TemporaryDirectory() as directory:
            incoming = Path(directory) / "incoming"
            legacy = f"deploy {'a' * 40} {'b' * 64} 1"
            input_stream = Mock(buffer=io.BytesIO(b""))
            with patch.dict(os.environ, {"SSH_ORIGINAL_COMMAND": legacy}), patch.object(receiver, "INCOMING", incoming), patch.object(receiver.signal, "alarm"), patch.object(sys, "stdin", input_stream):
                with self.assertRaises(ValueError):
                    receiver.main()
            self.assertFalse(incoming.exists())

    def test_verifies_complete_stream_before_activation(self):
        payload = b"archive bytes"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "release.tar.gz"
            receiver.receive(io.BytesIO(payload), path, hashlib.sha256(payload).hexdigest(), len(payload))
            self.assertEqual(path.read_bytes(), payload)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_rejects_truncated_oversize_and_modified_streams(self):
        payload = b"archive bytes"
        for data, size, digest in [(payload[:-1], len(payload), hashlib.sha256(payload).hexdigest()),
                                   (payload + b"x", len(payload), hashlib.sha256(payload).hexdigest()),
                                   (payload, len(payload), "0" * 64)]:
            with tempfile.TemporaryDirectory() as directory, self.assertRaises(ValueError):
                receiver.receive(io.BytesIO(data), Path(directory) / "release.tar.gz", digest, size)

    def test_forced_receiver_stages_verified_stream_before_telegram_activation(self):
        payload = b"synthetic Telegram artifact"
        commit, digest = "a" * 40, hashlib.sha256(payload).hexdigest()
        command = f"deploy-telegram {commit} {digest} {len(payload)}"
        with tempfile.TemporaryDirectory() as directory:
            incoming = Path(directory) / "incoming"
            def check_artifact(archive, expected_commit):
                self.assertEqual(archive.name, "telegram.tar.gz")
                self.assertEqual(archive.read_bytes(), payload)
                self.assertEqual(expected_commit, commit)
                self.assertEqual(archive.parent.parent, incoming)

            input_stream = Mock(buffer=io.BytesIO(payload))
            with patch.dict(os.environ, {"SSH_ORIGINAL_COMMAND": command}), patch.object(receiver, "INCOMING", incoming), patch.object(receiver.signal, "alarm"), patch.object(sys, "stdin", input_stream), patch.object(receiver, "activate_archive", side_effect=check_artifact) as activate:
                receiver.main()
            activate.assert_called_once()
            self.assertEqual(list(incoming.iterdir()), [])

    def test_activation_timeout_allows_signal_driven_rollback(self):
        process = Mock()
        process.wait.side_effect = [subprocess.TimeoutExpired("activate", 420), 1]
        with patch.object(receiver.subprocess, "Popen", return_value=process):
            with self.assertRaises(subprocess.TimeoutExpired):
                receiver.activate_archive(Path("/synthetic/archive"), "a" * 40)
        process.terminate.assert_called_once()
        process.kill.assert_not_called()
        self.assertEqual(process.wait.call_count, 2)

    def test_protocol_activates_only_telegram_by_commit(self):
        process = Mock()
        process.wait.return_value = 0
        with patch.object(receiver.subprocess, "Popen", return_value=process) as start:
            receiver.activate_archive(Path("/synthetic/telegram.tar.gz"), "a" * 40)
        arguments = start.call_args.args[0]
        self.assertEqual(Path(arguments[1]).name, "frontend.py")
        self.assertEqual(arguments[2:], ["activate-telegram", "--archive", "/synthetic/telegram.tar.gz", "--commit", "a" * 40])
        self.assertEqual(start.call_args.kwargs["env"], {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin"})


if __name__ == "__main__":
    unittest.main()
