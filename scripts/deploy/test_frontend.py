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
import sys
from unittest.mock import patch


MODULE = Path(__file__).with_name("frontend.py")
spec = importlib.util.spec_from_file_location("frontend", MODULE)
frontend = importlib.util.module_from_spec(spec)
if MODULE.exists():
    spec.loader.exec_module(frontend)


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        check = patch.object(frontend, "verify_collector_ready")
        self.collector_readiness = check.start()
        self.addCleanup(check.stop)
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
        for path in sorted(self.telegram.rglob("*")):
            if path.is_dir() or path.name == "release-set.json":
                continue
            data = path.read_bytes()
            rows.append({"path": "/" + path.relative_to(self.telegram).as_posix(), "byteLength": len(data), "sha256": hashlib.sha256(data).hexdigest()})
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

    def test_telegram_entry_blocks_old_sdk_and_all_collection_by_default(self):
        site = frontend.nginx_site(self.base, {"web": {"/index.html"}, "telegram": {"/index.html", "/telegram.123.js"}}).decode()
        web, telegram = site.split("    server_name domiknote.ru;")
        self.assertNotIn("/stats/", web)
        self.assertNotIn("analytics.domiknote.ru", site)
        self.assertEqual(telegram.count("frame-src 'none'"), 2)
        self.assertNotIn("location = /stats/tma-return", telegram)
        self.assertNotIn("location = /stats/tma-open {", telegram)
        self.assertIn("location = /stats/tma-open-v2 {",telegram)
        self.assertIn("location = /stats/tma-repeat-v2 {",telegram)
        self.assertIn("collect.sock", telegram)

    def test_activation_requires_compatible_private_collector_before_nginx_or_controls_can_change(self):
        self.package()
        root, site = self.server()
        self.collector_readiness.side_effect = RuntimeError("aggregate v2 unavailable")
        before = site.read_bytes()
        with self.assertRaisesRegex(RuntimeError, "aggregate v2"):
            frontend.activate_release(self.archive, root, site, command=lambda _: self.fail("nginx changed"),
                                      health=lambda _: self.fail("public traffic changed"))
        self.collector_readiness.assert_called_once_with()
        self.assertEqual(site.read_bytes(), before)
        self.assertEqual(os.readlink(root / "current"), "releases/old")
        self.assertFalse((root/"last-deployment.json").exists())

    def test_retired_catalog_files_and_hashes_are_denied_on_both_origins(self):
        retired = {
            'armchair-kursi-sofa.glb': 'b4a730f48ae1d8ec04c94ef99534002d381afa258144464b4df8892889f34eed',
            'armchair-kursi-sofa.png': '8509df74641cd762851eff7ed493c1c931efd986752fe13d83ce9508ec311ec4',
            'wooden-cabinet.glb': '9dd295594623edf797cee3d4da1818802d723b404df51687d6ca1796f51b4608',
            'wooden-cabinet.png': 'bded617fc7d3464f9102883d9da1d06ea76b0d76a230ae77feeeb78e9b8e83da',
            'zen-dining-chair.glb': '289c4d597eb5f38e7260afad2499d6e07a174261d613e8db28f260d40a0149e0',
            'zen-dining-chair.png': '11d2e14bea78f4e5961f5e02c3d24b80a3c4b4899ed55ac77d92d10af36e4e47',
        }
        previous = {'/catalog/' + name for name in retired} | {'/catalog/single-bed.glb'}
        site = frontend.nginx_site('/srv/frontend', {'web': previous, 'telegram': previous}).decode()
        for path in sorted({'/catalog/' + name for name in retired} |
                           {'/catalog-api/v1/resources/sha256/' + digest for digest in retired.values()}):
            self.assertEqual(site.count('location = ' + path + ' {'), 2)
            self.assertEqual(site.count('location = ' + path + ' { return 410; }'), 2)
        self.assertEqual(site.count('location = /catalog/single-bed.glb {'), 2)

    def test_roundtrip_checks_exact_files_and_preserves_both_targets(self):
        inventory = self.package()
        destination = self.base / "extracted"
        actual = frontend.extract_release(self.archive, destination)
        self.assertEqual(inventory, actual)
        self.assertEqual(actual["release"], "a" * 16 + "--" + "b" * 16)
        self.assertEqual((destination / "web/sw.js").read_bytes(), b"synthetic worker")

    def test_web_legal_documents_switch_revisions_at_stable_urls(self):
        documents = ("privacy-policy.html", "license-agreement.html", "analytics-consent.html")
        (self.web / "legal").mkdir()
        root, site = self.server()
        for revision in ("1", "2"):
            for name in documents:
                (self.web / "legal" / name).write_text(name + revision)
            (self.web / "release-manifest.json").write_text(json.dumps({"appBuildId": revision * 16}))
            self.package()
            frontend.activate_release(self.archive, root, site, command=lambda _: None,
                                      health=lambda _: None, ready=lambda _: None)
            web, telegram = site.read_text().split("    server_name domiknote.ru;")
            for name in documents:
                location = "    location = /legal/" + name + " {"
                block = web.split(location)[1].split("\n    }")[0]
                self.assertIn("/current/web;", block)
                self.assertIn('Cache-Control "no-store"', block)
                self.assertEqual((root / "current/web/legal" / name).read_text(), name + revision)
                self.assertNotIn(location, telegram)

    def test_redeployed_archive_keeps_published_bytes_for_both_origins(self):
        root, site = self.server()
        for number, edition in enumerate(("2026-11-22", "2026-11-23"), start=1):
            (self.web / "release-manifest.json").write_text(json.dumps({"appBuildId": str(number) * 16}))
            for directory in (self.web, self.telegram):
                (directory / "legal" / edition).mkdir(parents=True)
                (directory / "legal" / edition / "privacy-policy.html").write_text(edition)
                (directory / "legal/privacy-policy.html").write_text(edition)
            self.seal_telegram()
            self.package()
            frontend.activate_release(self.archive, root, site, command=lambda _: None,
                                      health=lambda _: None, ready=lambda _: None)
            for target in ("web", "telegram"):
                self.assertEqual((root / "current" / target / "legal/privacy-policy.html").read_text(), edition)
                old = root / "retained" / target / "legal/2026-11-22/privacy-policy.html"
                self.assertEqual(old.read_text(), "2026-11-22")
        for directory in (self.web, self.telegram):
            previous = directory / "legal/2026-11-22/privacy-policy.html"
            previous.write_text("different bytes")
            self.seal_telegram()
            self.package()
            with self.assertRaisesRegex(ValueError, "Immutable retained URL collision"):
                frontend.activate_release(self.archive, root, site, command=lambda _: None,
                                          health=lambda _: None, ready=lambda _: None)
            previous.write_text("2026-11-22")

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
                             ("deployed", 1), ("catalog", None),
                             *(("catalog", {"publicationSha256": value}) for value in
                               ["", "b" * 63, "b" * 65, "z" * 64, 3])):
            with self.subTest(field=field), self.assertRaises(ValueError):
                frontend.receipt_catalog_digest(inventory, {**receipt, field: value})
        for malformed in (None, [], {}, {**receipt, "catalog": {}}):
            with self.subTest(receipt=malformed), self.assertRaises(ValueError):
                frontend.receipt_catalog_digest(inventory, malformed)

    def public_response(self, origin, path, method="GET", headers=None, timeout=15):
        target = "telegram" if origin == frontend.ORIGINS["telegram"] else "web"
        directory = self.telegram if target == "telegram" else self.web
        if method == "POST":
            return 405, {}, b""
        if path == "/catalog-api/v1/catalogs/current":
            if headers and ("Cookie" in headers or "Authorization" in headers):
                return 400, {}, b""
            data = b'{"catalogVersion":"synthetic"}'
            return 200, {"etag": '"' + frontend.sha(data) + '"'}, data
        if path.startswith("/?"):
            path = "/index.html"
        file = directory / path[1:]
        if not file.is_file():
            return 404, {}, b""
        data = file.read_bytes()
        if headers and "Range" in headers:
            return 206, {"content-range": "bytes 0-3/" + str(len(data))}, data[:4]
        mime = {".js": "application/javascript", ".html": "text/html", ".json": "application/json", ".webmanifest": "application/manifest+json"}[file.suffix]
        cache = "no-store" if path in frontend.CONTROLS else "public, max-age=31536000, immutable"
        return 200, {"content-type": mime, "content-length": str(len(data)), "cache-control": cache,
                     "x-content-type-options": "nosniff", "referrer-policy": "no-referrer"}, b"" if method == "HEAD" else data

    def test_smoke_binds_both_public_catalogs_to_the_server_receipt(self):
        inventory = self.package()
        digest = frontend.sha(b'{"catalogVersion":"synthetic"}')
        with patch.object(frontend, "request", side_effect=self.public_response):
            self.assertTrue(frontend.smoke_release(inventory, expected_catalog_digest=digest)["passed"])
            with self.assertRaisesRegex(ValueError, "catalog.*digest"):
                frontend.smoke_release(inventory, expected_catalog_digest="f" * 64)
        for origin in frontend.ORIGINS.values():
            def changed_etag(url, path, *args, **kwargs):
                result = self.public_response(url, path, *args, **kwargs)
                if url == origin and path == "/catalog-api/v1/catalogs/current" and result[0] == 200:
                    return 200, {"etag": '"' + "f" * 64 + '"'}, result[2]
                return result
            with self.subTest(origin=origin), patch.object(frontend, "request", side_effect=changed_etag):
                with self.assertRaisesRegex(ValueError, "catalog.*digest"):
                    frontend.smoke_release(inventory, expected_catalog_digest=digest)
            def changed_bytes(url, path, *args, **kwargs):
                result = self.public_response(url, path, *args, **kwargs)
                if url == origin and path == "/catalog-api/v1/catalogs/current" and result[0] == 200:
                    return 200, result[1], b'{"catalogVersion":"changed"}'
                return result
            with self.subTest(origin=origin), patch.object(frontend, "request", side_effect=changed_bytes):
                with self.assertRaisesRegex(ValueError, "catalog.*digest"):
                    frontend.smoke_release(inventory, expected_catalog_digest=digest)

    def test_smoke_cli_checks_receipt_identity_before_network_access(self):
        inventory = self.package()
        receipt = self.base / "receipt.json"
        receipt.write_text(json.dumps({"deployed": True, "commit": "d" * 40, "release": inventory["release"],
                                       "catalog": {"publicationSha256": "b" * 64}}))
        with patch.object(sys, "argv", [str(MODULE), "smoke", "--archive", str(self.archive), "--receipt", str(receipt)]), patch.object(frontend, "request", side_effect=AssertionError("network before receipt")):
            with self.assertRaises(ValueError):
                frontend.main()
        digest = frontend.sha(b'{"catalogVersion":"synthetic"}')
        receipt.write_text(json.dumps({"deployed": True, "commit": inventory["commit"], "release": inventory["release"],
                                       "catalog": {"publicationSha256": digest}}))
        with patch.object(sys, "argv", [str(MODULE), "smoke", "--archive", str(self.archive), "--receipt", str(receipt)]), patch.object(frontend, "request", side_effect=self.public_response), patch.object(sys, "stdout", io.StringIO()) as output:
            frontend.main()
        self.assertTrue(json.loads(output.getvalue())["passed"])

    def test_server_health_uses_catalog_digest_and_rolls_back_on_mismatch(self):
        self.package()
        root, site = self.server()
        with patch.object(frontend, "smoke_release", side_effect=ValueError("catalog digest mismatch")) as health:
            with self.assertRaisesRegex(ValueError, "catalog digest mismatch"):
                frontend.activate_release(self.archive, root, site, command=lambda _: None, ready=lambda _: None,
                                          catalog_receipt={"changed": True, "publicationSha256": "b" * 64})
        self.assertEqual(health.call_args.kwargs, {"expected_catalog_digest": "b" * 64})
        self.assertEqual((root / "current").readlink().as_posix(), "releases/old")

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
