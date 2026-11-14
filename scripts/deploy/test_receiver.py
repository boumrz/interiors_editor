import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import subprocess


spec = importlib.util.spec_from_file_location("receiver", Path(__file__).with_name("receiver.py"))
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)


class ReceiverTests(unittest.TestCase):
    def test_accepts_only_exact_deploy_protocol(self):
        commit, digest = "a" * 40, "b" * 64
        self.assertEqual(receiver.parse_command(f"deploy {commit} {digest} 123"), (commit, digest, 123))
        for command in ["", "bash", f"deploy {commit} {digest} 0", f"deploy {commit} {digest} 9999999999",
                        f"deploy {commit} {digest} 123; id", f"deploy {commit} {digest} 123\n",
                        f"deploy {'A' * 40} {digest} 1", f"deploy {commit} {digest} -1"]:
            with self.subTest(command=command), self.assertRaises(ValueError):
                receiver.parse_command(command)

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

    def test_activation_timeout_allows_signal_driven_rollback(self):
        process = Mock()
        process.wait.side_effect = [subprocess.TimeoutExpired("activate", 420), 1]
        with patch.object(receiver.subprocess, "Popen", return_value=process):
            with self.assertRaises(subprocess.TimeoutExpired):
                receiver.activate_archive(Path("/synthetic/archive"), "a" * 40)
        process.terminate.assert_called_once()
        process.kill.assert_not_called()
        self.assertEqual(process.wait.call_count, 2)

    def test_protocol_activates_complete_project(self):
        process = Mock()
        process.wait.return_value = 0
        with patch.object(receiver.subprocess, "Popen", return_value=process) as start:
            receiver.activate_archive(Path("/synthetic/project.tar"), "a" * 40)
        arguments = start.call_args.args[0]
        self.assertEqual(Path(arguments[1]).name, "project_release.py")
        self.assertIn("/synthetic/project.tar", arguments)


if __name__ == "__main__":
    unittest.main()
