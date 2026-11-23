import hashlib
import importlib.util
import json
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("configure_github", Path(__file__).with_name("configure_github.py"))
configure = importlib.util.module_from_spec(spec)
spec.loader.exec_module(configure)


class ConfigureTests(unittest.TestCase):
    def test_missing_cli_stops_before_server_mutation(self):
        with patch.object(sys, "argv", ["configure_github.py"]), patch.object(configure.shutil, "which", return_value=None), patch.object(configure, "run") as run:
            with self.assertRaisesRegex(SystemExit, "Required command"):
                configure.main()
            run.assert_not_called()

    def test_receiver_only_update_preserves_github_and_ssh_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            admin = Path(directory) / "admin"
            admin.touch()
            arguments = ["configure_github.py", "--admin-key", str(admin), "--install-receiver-only"]
            def available(command):
                return "/usr/bin/ssh" if command == "ssh" else None
            with patch.object(sys, "argv", arguments), patch.object(configure.shutil, "which", side_effect=available), patch.object(configure, "run") as run:
                configure.main()
            calls = run.call_args_list
        self.assertEqual(len(calls), 2)
        for call in calls:
            self.assertEqual(call.args[0][0], "ssh")
            self.assertNotIn("authorized_keys", call.args[0][-1])
        self.assertNotIn("input", calls[0].kwargs)
        uploaded = json.loads(calls[1].kwargs["input"])
        self.assertEqual(set(uploaded), {"frontend.py", "receiver.py"})
        for name, received in uploaded.items():
            self.assertEqual(received.encode(), Path(__file__).with_name(name).read_bytes())

    def test_installer_preserves_rollback_link_target_and_validates_before_switching(self):
        with patch.object(configure, "run") as ssh:
            configure.install_receiver(["ssh", "synthetic-root"])
        code = shlex.split(ssh.call_args.args[0][-1])[-1]
        valid = ssh.call_args.kwargs["input"]
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)
            old = state / "tools-old" / "receiver.py"
            old.parent.mkdir(mode=0o700)
            old.write_text("# Installed receiver before update\n")
            entry = state / "receiver.py"
            entry.symlink_to(old)
            self.assertIn("'/opt/interiors-editor/deploy'", code)
            code = code.replace("'/opt/interiors-editor/deploy'", repr(directory)).replace(
                "root.stat().st_uid != 0", "root.stat().st_uid != os.getuid()"
            )
            def install(data):
                return subprocess.run([sys.executable, "-c", code], input=data, capture_output=True)

            sources = json.loads(valid)
            for invalid in ({**sources, "extra.py": ""}, {**sources, "receiver.py": "def invalid"}):
                self.assertNotEqual(install(json.dumps(invalid).encode()).returncode, 0)
                self.assertEqual(entry.readlink(), old)
            result = install(valid)
            self.assertEqual(result.returncode, 0, result.stderr)
            version = state / ("tools-" + hashlib.sha256(valid).hexdigest())
            self.assertEqual(entry.readlink(), version / "receiver.py")
            self.assertEqual(old.read_text(), "# Installed receiver before update\n")
            self.assertEqual(version.stat().st_mode & 0o777, 0o700)
            for name, content in sources.items():
                module = version / name
                self.assertEqual(module.read_bytes(), content.encode())
                self.assertEqual(module.stat().st_mode & 0o777, 0o600)

    def configure(self, restriction_works):
        calls = []
        def run(arguments, **kwargs):
            calls.append((arguments, kwargs))
            if arguments[:2] == ["ssh-keygen", "-F"]:
                return subprocess.CompletedProcess(arguments, 0, stdout="147.45.133.75 ssh-ed25519 trusted-public-host-key\n")
            if arguments[:2] == ["ssh-keygen", "-q"]:
                key = Path(arguments[arguments.index("-f") + 1])
                key.write_bytes(b"synthetic private deploy key")
                key.with_suffix(".pub").write_text("ssh-ed25519 AAAABBBB interiors-github-frontend\n")
            return subprocess.CompletedProcess(arguments, 0)
        with tempfile.TemporaryDirectory() as directory:
            admin = Path(directory) / "admin"
            admin.write_bytes(b"existing administrator credential")
            result = subprocess.CompletedProcess([], 1 if restriction_works else 0, stderr="Only the bounded Telegram deploy protocol is accepted")
            with patch.object(sys, "argv", ["configure_github.py", "--admin-key", str(admin)]), patch.object(configure.shutil, "which", return_value="available"), patch.object(configure, "run", side_effect=run), patch.object(configure.subprocess, "run", return_value=result) as restricted:
                if restriction_works:
                    configure.main()
                else:
                    with self.assertRaisesRegex(SystemExit, "Restricted deploy-key check failed"):
                        configure.main()
        return calls, restricted.call_args_list

    def test_secrets_use_stdin_after_restricted_receiver_check(self):
        calls, restrictions = self.configure(True)
        secrets = [(arguments, kwargs) for arguments, kwargs in calls if arguments[:3] == ["gh", "secret", "set"]]
        self.assertEqual(len(secrets), 2)
        self.assertEqual(secrets[0][1]["input"], b"synthetic private deploy key")
        for arguments, kwargs in calls:
            self.assertNotIn("synthetic private deploy key", " ".join(arguments))
            self.assertNotIn(b"existing administrator credential", kwargs.get("input", b""))
        self.assertTrue(all("production" in arguments for arguments, _ in secrets))
        self.assertEqual([call.args[0][-1] for call in restrictions], ["forbidden-shell", f"deploy {'a' * 40} {'b' * 64} 1"])
        code, content = next((arguments[-1], kwargs["input"]) for arguments, kwargs in calls if "tools-" in arguments[-1])
        self.assertIn("os.replace", code)
        self.assertEqual(set(json.loads(content)), {"frontend.py", "receiver.py"})

    def test_failed_key_restriction_never_publishes_credentials(self):
        calls, _ = self.configure(False)
        self.assertFalse(any(arguments[:3] == ["gh", "secret", "set"] for arguments, _ in calls))


if __name__ == "__main__":
    unittest.main()
