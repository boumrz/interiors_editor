from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import catalog_activate as deploy


class CatalogProcessTests(unittest.TestCase):
    def test_inspection_reads_the_running_jvm_before_accepting_the_unit(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            distribution = root / "catalog-control-plane"
            (distribution / "bin").mkdir(parents=True)
            (distribution / "lib").mkdir()
            (distribution / deploy.LAUNCHER).write_bytes(b"launcher")
            jar = distribution / "lib/application.jar"
            jar.write_bytes(b"synthetic")
            process = root / "proc/42"
            process.mkdir(parents=True)
            (process / "status").write_text("Uid:\t1000\t1000\t1000\t1000\nCapEff:\t00000000\n")
            (process / "environ").write_bytes(b"CATALOG_DATABASE_URL=\0CATALOG_DATABASE_USER=\0CATALOG_DATABASE_PASSWORD=\0")
            arguments = ["/usr/bin/java", "-classpath", str(jar), "dev.interiors.catalog.CatalogControlPlaneKt", "serve"]
            runtime_env = Mock()
            runtime_env.stat.return_value = SimpleNamespace(st_uid=0, st_mode=0o100600)
            runtime_env.is_file.return_value = True
            runtime_env.is_symlink.return_value = False

            def path(value):
                if value == "/proc":
                    return root / "proc"
                if value == deploy.RUNTIME_ENV:
                    return runtime_env
                return Path(value)

            with patch.object(deploy, "Path", side_effect=path), patch.object(deploy, "service_distribution", return_value=distribution), patch.object(deploy.subprocess, "run", return_value=SimpleNamespace(stdout="MainPID=42\n")), patch.object(deploy.pwd, "getpwnam", return_value=SimpleNamespace(pw_uid=1000)):
                for command, accepted in [(arguments, True), (arguments[:-1] + ["publish"], False)]:
                    (process / "cmdline").write_bytes(b"\0".join(value.encode() for value in command) + b"\0")
                    if accepted:
                        self.assertEqual(deploy.inspect_unit(), distribution)
                    else:
                        with self.assertRaises(ValueError):
                            deploy.inspect_unit()
                (process / "cmdline").write_bytes(b"\0".join(value.encode() for value in arguments))
                with self.assertRaisesRegex(ValueError, "Incomplete"):
                    deploy.inspect_unit()


class CatalogActivationTests(unittest.TestCase):
    commit = "a" * 40

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.releases = self.root / "releases"
        self.dropin = self.root / "interiors-catalog.service.d/90-interiors-deployment.conf"
        self.old = self.releases / "20261106-initial/catalog-control-plane"
        self.write_dist(self.old, b"old")
        self.candidate = self.releases / self.commit / "catalog-control-plane"
        self.unit = self.old
        self.publications = []
        self.restarts = []
        self.new_content = b"new"

        def extract(archive, dist, commit):
            self.assertEqual(commit, self.commit)
            self.write_dist(dist, self.new_content)
            return {"files": deploy.runtime_files(dist)}

        def restart():
            self.unit = self.candidate if self.dropin.exists() else self.old
            self.restarts.append(self.unit)

        def healthy(expected=None):
            self.publications.append(expected)
            return "original-publication-digest"

        for name, value in [("RELEASES", self.releases), ("DROPIN", self.dropin)]:
            self.enter_patch(patch.object(deploy, name, value))
        self.enter_patch(patch.object(deploy, "inspect_unit", side_effect=lambda: self.unit))
        self.enter_patch(patch.object(deploy, "restart_catalog", side_effect=restart))
        self.probe = self.enter_patch(patch.object(deploy, "wait_publication", side_effect=healthy))
        self.schema = self.enter_patch(patch.object(deploy.catalog_package, "verify_catalog_schema"))
        self.enter_patch(patch.object(deploy.catalog_package, "extract_catalog", side_effect=extract))

    def enter_patch(self, patcher):
        self.addCleanup(patcher.stop)
        return patcher.start()

    def write_dist(self, directory, data):
        (directory / "lib").mkdir(parents=True)
        (directory / "bin").mkdir()
        (directory / "lib/application.jar").write_bytes(data)
        (directory / deploy.LAUNCHER).write_bytes(b"launcher")
        (directory / deploy.LAUNCHER).chmod(0o755)

    def test_runtime_switches_before_frontend_and_same_commit_retry_is_idempotent(self):
        with deploy.active_catalog("payload", self.commit) as receipt:
            self.assertTrue(receipt["changed"])
            self.assertEqual(self.unit, self.candidate)
            self.assertIn(str(self.candidate / deploy.LAUNCHER) + " serve", self.dropin.read_text())
            self.assertEqual((self.old / "lib/application.jar").read_bytes(), b"old")
        with deploy.active_catalog("payload", self.commit) as receipt:
            self.assertFalse(receipt["changed"])
        self.assertEqual(self.restarts, [self.candidate])

    def test_unchanged_runtime_avoids_restart_and_keeps_existing_unit(self):
        self.new_content = b"old"
        with deploy.active_catalog("payload", self.commit) as receipt:
            self.assertFalse(receipt["changed"])
        self.assertFalse(self.dropin.exists())
        self.assertFalse(self.restarts)

    def test_frontend_failure_restores_original_runtime(self):
        with self.assertRaisesRegex(ValueError, "frontend"):
            with deploy.active_catalog("payload", self.commit):
                raise ValueError("frontend delivery failed")
        self.assertFalse(self.dropin.exists())
        self.assertEqual(self.restarts, [self.candidate, self.old])
        self.assertEqual(self.publications, [None, "original-publication-digest", "original-publication-digest"])

    def test_prior_override_is_restored_byte_for_byte_on_failed_health(self):
        self.dropin.parent.mkdir()
        old_override = deploy.exec_override(self.old)
        self.dropin.write_bytes(old_override)
        self.probe.side_effect = ["original-publication-digest", ValueError("catalog changed"), "original-publication-digest"]

        def restart_from_dropin():
            self.unit = self.old if self.dropin.read_bytes() == old_override else self.candidate

        with patch.object(deploy, "restart_catalog", side_effect=restart_from_dropin):
            with self.assertRaisesRegex(ValueError, "catalog changed"):
                with deploy.active_catalog("payload", self.commit):
                    self.fail("should never publish frontend")
        self.assertEqual(self.dropin.read_bytes(), old_override)
        self.assertEqual(self.unit, self.old)

    def test_mismatch_in_schema_or_existing_commit_precedes_service_changes(self):
        self.schema.side_effect = ValueError("schema changed")
        with self.assertRaisesRegex(ValueError, "schema changed"):
            with deploy.active_catalog("payload", self.commit):
                self.fail()
        self.schema.side_effect = None
        self.write_dist(self.candidate, b"different")
        with self.assertRaisesRegex(ValueError, "different"):
            with deploy.active_catalog("payload", self.commit):
                self.fail()
        self.assertFalse(self.dropin.exists())
        self.assertFalse(self.restarts)

    def test_running_jvm_must_match_the_configured_release(self):
        jar = str(self.old / "lib/application.jar")
        arguments = ["/usr/bin/java", "-Xmx256m", "-classpath", jar, "dev.interiors.catalog.CatalogControlPlaneKt", "serve"]
        deploy.verify_process_distribution(self.old, arguments)
        for changed in [arguments[:-1] + ["publish"], arguments[:3] + [jar + ":/opt/other.jar"] + arguments[4:],
                        arguments[:3] + [jar.replace("20261106-initial", self.commit)] + arguments[4:],
                        arguments[:3] + [jar + ":" + jar] + arguments[4:],
                        arguments[:2] + arguments[3:], arguments[:-2] + ["WrongMain", "serve"],
                        arguments + ["extra"], ["/usr/bin/other"] + arguments[1:],
                        arguments[:2] + ["-jar", "/opt/other.jar"] + arguments[2:]]:
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                deploy.verify_process_distribution(self.old, changed)
        dependency = self.old / "lib/dependency.jar"
        dependency.write_bytes(b"dependency")
        with self.assertRaises(ValueError):
            deploy.verify_process_distribution(self.old, arguments)
        deploy.verify_process_distribution(self.old, arguments[:3] + [str(dependency) + ":" + jar] + arguments[4:])

    def test_unit_contract_only_accepts_scoped_user_runtime_env_and_exact_launcher(self):
        launcher = str(self.old / deploy.LAUNCHER)
        properties = dict(User="interiors-catalog", Group="interiors-catalog", ActiveState="active",
                          NoNewPrivileges="yes", ProtectSystem="strict", MainPID="1024",
                          FragmentPath="/etc/systemd/system/interiors-catalog.service",
                          EnvironmentFiles="/etc/interiors-editor/catalog/runtime.env (ignore_errors=no)",
                          ExecStart="{ path=" + launcher + " ; argv[]=" + launcher + " serve ; ignore_errors=no ; }")
        self.assertEqual(deploy.service_distribution(properties), self.old)
        for key, invalid in [("User", "root"), ("Group", "root"), ("NoNewPrivileges", "no"),
                             ("EnvironmentFiles", "/etc/interiors-editor/catalog/publish.env (ignore_errors=no)"),
                             ("ExecStart", properties["ExecStart"].replace(" serve ;", " publish ;")),
                             ("ExecStart", properties["ExecStart"].replace(launcher, "/opt/other/bin/catalog")),
                             ("MainPID", "0")]:
            with self.subTest(key=key, value=invalid), self.assertRaises(ValueError):
                deploy.service_distribution({**properties, key: invalid})


if __name__ == "__main__":
    unittest.main()
