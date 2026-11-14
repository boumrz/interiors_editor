"""Deployment boundary tests; no network, root access or live files required."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch


MODULE = Path(__file__).with_name("frontend.py")
spec = importlib.util.spec_from_file_location("frontend", MODULE)
frontend = importlib.util.module_from_spec(spec)
if MODULE.exists():
    spec.loader.exec_module(frontend)


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.web = self.base / "web"
        self.telegram = self.base / "telegram"
        for target, directory, build in (("web", self.web, "a" * 16), ("telegram", self.telegram, "b" * 16)):
            directory.mkdir()
            (directory / "index.html").write_text("<html>synthetic " + target + "</html>")
            (directory / "release-manifest.json").write_text(json.dumps({"appBuildId": build}))
            (directory / ("main.123.js" if target == "web" else "telegram.123.js")).write_bytes(b"synthetic JS")
        (self.web / "sw.js").write_bytes(b"synthetic worker")
        (self.web / "manifest.webmanifest").write_bytes(b"{}")
        self.seal_telegram()
        self.archive = self.base / "frontend.tar.gz"

    def seal_telegram(self):
        rows = []
        for path in sorted(self.telegram.iterdir()):
            if path.name == "release-set.json":
                continue
            data = path.read_bytes()
            rows.append({"path": "/" + path.name, "byteLength": len(data), "sha256": hashlib.sha256(data).hexdigest()})
        (self.telegram / "release-set.json").write_text(json.dumps({"version": 1, "deliveryTarget": "telegram", "appBuildId": "b" * 16, "entryPath": "/telegram.123.js", "assets": rows}))

    def package(self):
        return frontend.package_release(self.web, self.telegram, self.archive, "c" * 40)

    def server(self):
        root = self.base / "server"
        (root / "releases" / "old").mkdir(parents=True)
        (root / "current").symlink_to("releases/old")
        site = self.base / "site.conf"
        site.write_bytes(b"original config\n")
        return root, site

    def test_roundtrip_checks_exact_files_and_preserves_both_targets(self):
        inventory = self.package()
        destination = self.base / "extracted"
        actual = frontend.extract_release(self.archive, destination)
        self.assertEqual(inventory, actual)
        self.assertEqual(actual["release"], "a" * 16 + "--" + "b" * 16)
        self.assertEqual((destination / "web/sw.js").read_bytes(), b"synthetic worker")

    def test_activation_refuses_source_commit_mismatch_before_mutation(self):
        self.package()
        root, site = self.server()
        with self.assertRaisesRegex(ValueError, "commit"):
            frontend.activate_release(self.archive, root, site, expected_commit="d" * 40, command=lambda _: None, health=lambda _: None, ready=lambda _: None)
        self.assertEqual(site.read_bytes(), b"original config\n")
        self.assertEqual((root / "current").readlink().as_posix(), "releases/old")

    def test_package_rejects_missing_pwa_and_unsealed_telegram_bytes(self):
        (self.web / "sw.js").unlink()
        with self.assertRaises(ValueError):
            self.package()
        (self.web / "sw.js").write_bytes(b"worker")
        (self.telegram / "telegram.123.js").write_bytes(b"changed")
        with self.assertRaises(ValueError):
            self.package()

    def test_package_refuses_symlinks_and_telegram_workers(self):
        (self.web / "unexpected.js").symlink_to(self.web / "main.123.js")
        with self.assertRaises(ValueError):
            self.package()
        (self.web / "unexpected.js").unlink()
        (self.telegram / "sw.js").write_bytes(b"forbidden")
        self.seal_telegram()
        with self.assertRaises(ValueError):
            self.package()

    def test_archive_refuses_traversal_links_duplicates_and_uninventoried_files(self):
        self.package()
        for name, kind in (("../escape", "file"), ("/absolute", "file"), ("web/link", "symlink"), ("web/hard", "hardlink"), ("web/extra.js", "file"), ("inventory.json", "file")):
            with self.subTest(name=name):
                malformed = self.base / "malformed.tar.gz"
                with tarfile.open(self.archive) as source, tarfile.open(malformed, "w:gz") as output:
                    for member in source:
                        output.addfile(member, source.extractfile(member))
                    member = tarfile.TarInfo(name)
                    member.type = {"file": tarfile.REGTYPE, "symlink": tarfile.SYMTYPE, "hardlink": tarfile.LNKTYPE}[kind]
                    member.linkname = "web/main.123.js" if kind != "file" else ""
                    member.size = 1 if kind == "file" else 0
                    output.addfile(member, io.BytesIO(b"x") if kind == "file" else None)
                with self.assertRaises(ValueError):
                    frontend.extract_release(malformed, self.base / ("bad-" + kind + str(len(name))))
        self.assertFalse((self.base / "escape").exists())

    def test_activation_retains_old_assets_and_switches_only_after_nginx_reload(self):
        self.package()
        root, site = self.server()
        old = root / "retained/web/old.abc.js"
        old.parent.mkdir(parents=True)
        old.write_bytes(b"old lazy chunk")
        commands = []
        def command(arguments):
            commands.append(arguments)
            self.assertEqual((root / "current").readlink().as_posix(), "releases/old")
        result = frontend.activate_release(self.archive, root, site, command=command, health=lambda inventory: None, ready=lambda _: None)
        self.assertEqual((root / "current").readlink().as_posix(), "releases/" + result["release"])
        self.assertEqual(old.read_bytes(), b"old lazy chunk")
        self.assertEqual((root / "releases" / result["release"]).stat().st_mode & 0o777, 0o755)
        config = site.read_text()
        self.assertIn("location = /old.abc.js", config)
        self.assertIn("location / { return 404; }", config)
        self.assertEqual(commands, [["nginx", "-t"], ["systemctl", "reload", "nginx"]])

    def test_health_failure_restores_pointer_and_keeps_new_lazy_urls_available(self):
        self.package()
        root, site = self.server()
        commands = []
        def failed_health(_):
            raise RuntimeError("synthetic health failure")
        with self.assertRaisesRegex(RuntimeError, "synthetic health failure"):
            frontend.activate_release(self.archive, root, site, command=commands.append, health=failed_health, ready=lambda _: None)
        self.assertEqual((root / "current").readlink().as_posix(), "releases/old")
        self.assertIn("location = /main.123.js", site.read_text())
        self.assertIn("location = /telegram.123.js", site.read_text())
        self.assertEqual(commands[-2:], [["nginx", "-t"], ["systemctl", "reload", "nginx"]])

    def test_combined_receipt_records_catalog_only_after_healthy_frontend(self):
        self.package()
        root, site = self.server()
        catalog = {"changed": True, "commit": "c" * 40}
        result = frontend.activate_release(self.archive, root, site, command=lambda _: None,
                                          health=lambda _: None, ready=lambda _: None, catalog_receipt=catalog)
        self.assertEqual(json.loads((root / "last-deployment.json").read_bytes()), result)
        self.assertEqual(result["catalog"], catalog)
        self.assertIs(result["backendChanged"], True)

    def test_runner_requires_matching_server_receipt_before_using_the_catalog_digest(self):
        inventory = self.package()
        receipt = {"deployed": True, "commit": inventory["commit"], "release": inventory["release"],
                   "catalog": {"publicationSha256": "b" * 64}}
        self.assertEqual(frontend.receipt_catalog_digest(inventory, receipt), "b" * 64)
        for field, value in (("deployed", False), ("commit", "d" * 40), ("release", "old"),
                             ("catalog", {"publicationSha256": ""})):
            with self.subTest(field=field), self.assertRaises(ValueError):
                frontend.receipt_catalog_digest(inventory, {**receipt, field: value})

    def test_smoke_has_a_total_deadline_before_network_io(self):
        inventory = self.package()
        with patch.object(frontend, "request", side_effect=AssertionError("must not request")):
            with self.assertRaisesRegex(ValueError, "deadline"):
                frontend.smoke_release(inventory, timeout_seconds=0)

    def test_smoke_rejects_javascript_with_html_mime_even_if_bytes_match(self):
        inventory = self.package()
        def wrong_mime(origin, path, method="GET", headers=None, timeout=15):
            target = "telegram" if origin == frontend.ORIGINS["telegram"] else "web"
            directory = self.telegram if target == "telegram" else self.web
            data = (directory / path[1:]).read_bytes()
            cache = "no-store" if path in frontend.CONTROLS else "public, max-age=31536000, immutable"
            return 200, {"content-type": "text/html", "content-length": str(len(data)), "cache-control": cache, "x-content-type-options": "nosniff", "referrer-policy": "no-referrer"}, b"" if method == "HEAD" else data
        with patch.object(frontend, "request", side_effect=wrong_mime):
            with self.assertRaisesRegex(ValueError, "MIME"):
                frontend.smoke_release(inventory)

    def test_deployment_directories_remain_readable_with_private_admin_umask(self):
        nested = self.web / "catalog/models"
        nested.mkdir(parents=True)
        (nested / "item.glb").write_bytes(b"synthetic")
        self.package()
        root, site = self.server()
        previous_umask = os.umask(0o077)
        try:
            result = frontend.activate_release(self.archive, root, site, command=lambda _: None, health=lambda _: None, ready=lambda _: None)
        finally:
            os.umask(previous_umask)
        release = root / "releases" / result["release"]
        for directory in (release, release / "web", release / "web/catalog/models", root / "retained", root / "retained/web", root / "retained/web/catalog/models"):
            self.assertEqual(directory.stat().st_mode & 0o777, 0o755, str(directory))

    def test_collision_and_bad_nginx_do_not_switch_current(self):
        self.package()
        root, site = self.server()
        conflicting = root / "retained/web/main.123.js"
        conflicting.parent.mkdir(parents=True)
        conflicting.write_bytes(b"other immutable bytes")
        with self.assertRaises(ValueError):
            frontend.activate_release(self.archive, root, site, command=lambda _: None, health=lambda _: None, ready=lambda _: None)
        self.assertEqual(site.read_bytes(), b"original config\n")
        conflicting.unlink()
        count = 0
        def syntax_error(_):
            nonlocal count
            count += 1
            if count == 1:
                raise RuntimeError("invalid nginx")
        with self.assertRaisesRegex(RuntimeError, "invalid nginx"):
            frontend.activate_release(self.archive, root, site, command=syntax_error, health=lambda _: None, ready=lambda _: None)
        self.assertEqual((root / "current").readlink().as_posix(), "releases/old")
        self.assertEqual(site.read_bytes(), b"original config\n")

    def test_readiness_checks_default_to_public_probes_before_pointer_switch(self):
        self.package()
        root, site = self.server()
        def readiness(inventory):
            self.assertEqual((root / "current").readlink().as_posix(), "releases/old")
            self.assertIn("location = /main.123.js", site.read_text())
        with patch.object(frontend, "wait_for_assets", side_effect=readiness) as probe:
            frontend.activate_release(self.archive, root, site, command=lambda _: None, health=lambda _: None)
            probe.assert_called_once()

    def test_readiness_failure_restores_config_without_switching_or_health(self):
        self.package()
        root, site = self.server()
        def not_ready(_):
            self.assertEqual((root / "current").readlink().as_posix(), "releases/old")
            raise ValueError("assets not ready")
        with self.assertRaisesRegex(ValueError, "assets not ready"):
            frontend.activate_release(self.archive, root, site, command=lambda _: None, health=lambda _: self.fail("health before readiness"), ready=not_ready)
        self.assertEqual((root / "current").readlink().as_posix(), "releases/old")
        self.assertEqual(site.read_bytes(), b"original config\n")

    def test_readiness_retries_missing_immutable_url_and_has_deadline(self):
        inventory = self.package()
        responses = 0
        def becoming_ready(origin, path, method="GET", headers=None, timeout=15):
            nonlocal responses
            responses += 1
            self.assertEqual(method, "HEAD")
            self.assertNotIn(path, frontend.CONTROLS)
            target = "telegram" if origin == frontend.ORIGINS["telegram"] else "web"
            row = next(row for row in inventory["targets"][target] if row["path"] == path)
            if responses == 1:
                return 404, {}, b""
            return 200, {"content-length": str(row["byteLength"]), "cache-control": "public, max-age=31536000, immutable", "content-type": "application/javascript"}, b""
        with patch.object(frontend, "request", side_effect=becoming_ready), patch.object(frontend.time, "sleep"):
            frontend.wait_for_assets(inventory)
        self.assertGreater(responses, 2)
        with patch.object(frontend, "request", side_effect=AssertionError("past deadline")):
            with self.assertRaisesRegex(ValueError, "deadline"):
                frontend.wait_for_assets(inventory, timeout_seconds=0)


if __name__ == "__main__":
    unittest.main()
