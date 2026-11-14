import importlib.util
from pathlib import Path
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
            result = subprocess.CompletedProcess([], 1 if restriction_works else 0, stderr="Only the bounded project deploy protocol is accepted")
            with patch.object(sys, "argv", ["configure_github.py", "--admin-key", str(admin)]), patch.object(configure.shutil, "which", return_value="available"), patch.object(configure, "run", side_effect=run), patch.object(configure.subprocess, "run", return_value=result):
                if restriction_works:
                    configure.main()
                else:
                    with self.assertRaisesRegex(SystemExit, "Restricted deploy-key check failed"):
                        configure.main()
        return calls

    def test_secrets_use_stdin_after_restricted_receiver_check(self):
        calls = self.configure(True)
        secrets = [(arguments, kwargs) for arguments, kwargs in calls if arguments[:3] == ["gh", "secret", "set"]]
        self.assertEqual(len(secrets), 2)
        self.assertEqual(secrets[0][1]["input"], b"synthetic private deploy key")
        for arguments, kwargs in calls:
            self.assertNotIn("synthetic private deploy key", " ".join(arguments))
            self.assertNotIn(b"existing administrator credential", kwargs.get("input", b""))
        self.assertTrue(all("production" in arguments for arguments, _ in secrets))
        for name in ("catalog_activate.py", "catalog_package.py", "project_release.py"):
            self.assertTrue(any(name in str(arguments[-1]) for arguments, _ in calls))

    def test_failed_key_restriction_never_publishes_credentials(self):
        calls = self.configure(False)
        self.assertFalse(any(arguments[:3] == ["gh", "secret", "set"] for arguments, _ in calls))


if __name__ == "__main__":
    unittest.main()
