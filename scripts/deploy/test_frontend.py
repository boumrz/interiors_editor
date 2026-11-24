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

    def seal_telegram(self, entry="telegram.123.js"):
        rows = []
        for path in sorted(self.telegram.rglob("*")):
            if path.is_dir() or path.name == "release-set.json":
                continue
            data = path.read_bytes()
            rows.append({"path": "/" + path.relative_to(self.telegram).as_posix(), "byteLength": len(data), "sha256": hashlib.sha256(data).hexdigest()})
        build = json.loads((self.telegram / "release-manifest.json").read_bytes())["appBuildId"]
        (self.telegram / "release-set.json").write_text(json.dumps({"version": 1, "deliveryTarget": "telegram", "appBuildId": build, "entryPath": "/" + entry, "assets": rows}))

    def package(self):
        return frontend.package_release(self.web, self.telegram, self.archive, "c" * 40)

    def server(self):
        root = self.base / "server"
        (root / "releases" / "old").mkdir(parents=True)
        (root / "current").symlink_to("releases/old")
        site = self.base / "site.conf"
        site.write_bytes(b"original config\n")
        return root, site

    def telegram_update(self):
        root, site = self.server()
        old = self.package()
        frontend.activate_release(
            self.archive, root, site, command=lambda _: None,
            health=lambda _: None, ready=lambda _: None,
        )
        (self.telegram / "release-manifest.json").write_text(json.dumps({"appBuildId": "d" * 16}))
        (self.telegram / "index.html").write_bytes(b"new Telegram page")
        (self.telegram / "telegram.123.js").rename(self.telegram / "telegram.456.js")
        self.seal_telegram("telegram.456.js")
        partial = self.base / "telegram.tar.gz"
        incoming = frontend.package_telegram_release(self.telegram, partial, "e" * 40)
        return root, site, old, partial, incoming

    def test_telegram_package_cli_seals_only_the_telegram_build(self):
        output = self.base / "telegram.tar.gz"
        arguments = [str(MODULE), "package-telegram", "--telegram", str(self.telegram),
                     "--output", str(output), "--commit", "e" * 40]
        with patch.object(sys, "argv", arguments), patch.object(sys, "stdout", io.StringIO()) as stdout:
            frontend.main()
        self.assertEqual(json.loads(stdout.getvalue()), {
            "packaged": True, "target": "telegram", "commit": "e" * 40, "release": "b" * 16,
        })
        with tarfile.open(output) as archive:
            self.assertEqual(set(archive.getnames()), {"inventory.json", *(
                "telegram/" + file.name for file in self.telegram.iterdir()
            )})
        destination = self.base / "telegram-extracted"
        sealed = frontend.extract_telegram_release(output, destination)
        self.assertEqual(sealed["commit"], "e" * 40)
        self.assertEqual(sealed["targets"], {"telegram": frontend.file_rows(self.telegram)})
        self.assertFalse((destination / "web").exists())
        with self.assertRaises(ValueError):
            frontend.extract_release(output, self.base / "invalid-full-release")

    def test_telegram_archive_rejects_full_target_and_bad_member_digest(self):
        self.package()
        with self.assertRaises(ValueError):
            frontend.extract_telegram_release(self.archive, self.base / "forbidden-full-release")
        archive = self.base / "telegram.tar.gz"
        frontend.package_telegram_release(self.telegram, archive, "e" * 40)
        for extra, replace in (("web/index.html", None), (None, "telegram/index.html")):
            malformed = self.base / ("forbidden-web.tar.gz" if extra else "bad-digest.tar.gz")
            with tarfile.open(archive) as source, tarfile.open(malformed, "w:gz") as output:
                for member in source:
                    data = source.extractfile(member).read()
                    output.addfile(member, io.BytesIO(b"x" * len(data) if member.name == replace else data))
                if extra:
                    extra_member = tarfile.TarInfo(extra)
                    output.addfile(extra_member, io.BytesIO(b""))
            with self.subTest(extra=extra, replace=replace), self.assertRaises(ValueError):
                frontend.extract_telegram_release(malformed, self.base / malformed.stem)

    def test_telegram_archive_preserves_two_legal_editions_with_the_same_date(self):
        paths = []
        for edition in ("2026-11-24", "2026-11-24.2"):
            path = Path("legal") / edition / "telegram-support-privacy.html"
            document = self.telegram / path
            document.parent.mkdir(parents=True)
            document.write_text(edition)
            paths.append(path)
        self.seal_telegram()
        output = self.base / "telegram.tar.gz"
        frontend.package_telegram_release(self.telegram, output, "e" * 40)
        extracted = self.base / "extracted"
        frontend.extract_telegram_release(output, extracted)
        for path in paths:
            self.assertEqual((extracted / "telegram" / path).read_bytes(),
                             (self.telegram / path).read_bytes())

    def test_telegram_activation_preserves_active_web_assets_and_nginx_block(self):
        root, site, old, archive, incoming = self.telegram_update()
        web_files = frontend.file_rows(root / "current/web")
        (self.web / "index.html").write_bytes(b"unpublished Web")
        stale_asset = root / "retained/web/staged-only.js"
        stale_asset.write_bytes(b"staged by another deployment")
        retained_web = frontend.file_rows(root / "retained/web")
        old_config = site.read_bytes().replace(b"    server_name www.domiknote.ru;\n",
                                               b"    server_name www.domiknote.ru;\n    # keep the existing Web block\n")
        site.write_bytes(old_config)
        observed = []

        def observe(phase, inventory):
            self.assertEqual(inventory["targets"], incoming["targets"])
            active = root / "current"
            self.assertEqual(frontend.file_rows(active / "web"), web_files)
            self.assertEqual(active.readlink().name, old["release"] if phase == "ready" else "a" * 16 + "--" + "d" * 16)
            for lock_name in (".project-deploy.lock", ".deploy.lock"):
                with (root / lock_name).open("a") as lock:
                    with self.assertRaises(BlockingIOError):
                        frontend.fcntl.flock(lock, frontend.fcntl.LOCK_EX | frontend.fcntl.LOCK_NB)
            observed.append(phase)

        receipt = frontend.activate_telegram_release(
            archive, incoming["commit"], root=root, site=site, command=lambda _: None,
            ready=lambda inventory: observe("ready", inventory),
            health=lambda inventory: observe("health", inventory),
        )
        self.assertEqual(observed, ["ready", "health"])
        self.assertEqual(receipt, {
            "deployed": True, "target": "telegram", "commit": incoming["commit"],
            "release": "a" * 16 + "--" + "d" * 16, "previous": "releases/" + old["release"],
            "webBuildId": "a" * 16, "telegramBuildId": "d" * 16,
            "backendChanged": False, "retainedAssetsDeleted": False,
        })
        self.assertEqual(json.loads((root / "last-deployment.json").read_bytes()), receipt)
        self.assertEqual(frontend.file_rows(root / "retained/web"), retained_web)
        self.assertEqual(site.read_bytes().rpartition(b"\nserver {\n")[0],
                         old_config.rpartition(b"\nserver {\n")[0])
        self.assertNotIn(b"staged-only.js", site.read_bytes())
        self.assertIn(b"/telegram.123.js", site.read_bytes())
        self.assertIn(b"/telegram.456.js", site.read_bytes())
        self.assertEqual(json.loads((root / "current/inventory.json").read_bytes())["targets"],
                         {"web": web_files, **incoming["targets"]})

    def test_project_transfer_boundaries_and_streaming_apply_only_to_enabled_telegram_host(self):
        paths = {"web": set(), "telegram": set()}
        self.assertNotIn(b"project-transfer", frontend.nginx_site(self.base, paths))
        config = frontend.nginx_site(self.base, paths, project_transfer_relay=True)
        prefix, web, telegram = config.rsplit(b"\nserver {\n", 2)
        upload = b"/project-transfer/v1/files"
        token = b"^/project-transfer/v1/files/[A-Za-z0-9_-]{43}$"
        self.assertIn(b"limit_req_zone $binary_remote_addr zone=interiors_project_transfer_requests:1m rate=6r/m;", prefix)
        self.assertIn(b"limit_conn_zone $binary_remote_addr zone=interiors_project_transfer_connections:1m;", prefix)
        self.assertNotIn(upload, web)
        self.assertIn(b"set $frontend_method_path \"$request_method:$request_uri\";", telegram)
        self.assertIn(b"|/project-transfer/v1/files)$", telegram)
        self.assertIn(b"location = " + upload + b" {", telegram)
        self.assertIn(b'if ($request_uri != "' + upload + b'") { return 404; }', telegram)
        self.assertIn(b'location ~ "' + token + b'" {', telegram)
        self.assertIn(b'if ($request_uri !~ "' + token + b'") { return 404; }', telegram)
        self.assertIn(b"client_max_body_size 199229492;", telegram)
        self.assertIn(b"proxy_set_header Content-Type $content_type;", telegram)
        self.assertIn(b"proxy_set_header Content-Length $content_length;", telegram)
        self.assertIn(b"proxy_pass_request_body off;", telegram)
        self.assertNotIn(b"Access-Control-Allow-Origin", telegram)
        for value in (b"limit_conn interiors_project_transfer_connections 4;",
                      b"limit_req zone=interiors_project_transfer_requests burst=12 nodelay;",
                      b"limit_conn_status 429;", b"limit_req_status 429;", b"access_log off;",
                      b"error_log /dev/null crit;", b"proxy_request_buffering off;", b"proxy_buffering off;",
                      b"proxy_pass_request_headers off;", b"proxy_set_header Host 127.0.0.1;",
                      b"proxy_pass http://127.0.0.1:4182;"):
            with self.subTest(value=value):
                self.assertGreaterEqual(telegram.count(value), 2)

    def test_project_transfer_explicit_activation_survives_retirement_repeat_and_restore(self):
        root, site, _, archive, incoming = self.telegram_update()
        frontend.set_web_retirement(True, root, site, command=lambda _: None, health=lambda *_: None)
        retired_before = site.read_bytes().split(b"\nserver {\n")[1]
        for enable in (True, False):
            frontend.activate_telegram_release(
                archive, incoming["commit"], root=root, site=site, command=lambda _: None,
                ready=lambda _: None, health=lambda _: None, enable_project_transfer_relay=enable,
            )
            current = site.read_bytes()
            self.assertEqual(current.count(b"limit_req_zone"), 1)
            self.assertEqual(current.count(b"limit_conn_zone"), 1)
            self.assertEqual(current.rsplit(b"\nserver {\n", 2)[1], retired_before)
            self.assertIn(b"proxy_pass http://127.0.0.1:4182;", current)
        frontend.set_web_retirement(False, root, site, command=lambda _: None, health=lambda *_: None)
        self.assertEqual(site.read_bytes().count(b"limit_req_zone"), 1)
        self.assertNotIn(b"project-transfer", site.read_bytes().rsplit(b"\nserver {\n", 2)[1])

    def test_failed_release_preserves_web_retirement_and_does_not_enable_relay(self):
        root, site, old, archive, incoming = self.telegram_update()
        frontend.set_web_retirement(True, root, site, command=lambda _: None, health=lambda *_: None)
        retired_before = site.read_bytes().split(b"\nserver {\n")[1]

        def fail_health(_):
            self.assertIn(b"/project-transfer/v1/files", site.read_bytes())
            raise RuntimeError("reject release")

        with self.assertRaisesRegex(RuntimeError, "reject release"):
            frontend.activate_telegram_release(
                archive, incoming["commit"], root=root, site=site, command=lambda _: None,
                ready=lambda _: None, health=fail_health, enable_project_transfer_relay=True,
            )
        self.assertEqual((root / "current").readlink().name, old["release"])
        rollback = site.read_bytes()
        self.assertEqual(rollback.split(b"\nserver {\n")[1], retired_before)
        self.assertNotIn(b"limit_req_zone", rollback)
        self.assertNotIn(b"/project-transfer/v1/files", rollback)
        self.assertIn(b"/telegram.456.js", rollback)

    def test_retirement_hides_web_assets_without_changing_release_and_survives_telegram_update(self):
        root, site, old, archive, incoming = self.telegram_update()
        original = site.read_bytes().replace(b"    server_name www.domiknote.ru;\n",
                                             b"    server_name www.domiknote.ru;\n    # custom transport setting\n")
        site.write_bytes(original)
        http, web, telegram = original.split(b"\nserver {\n")
        active_web = frontend.file_rows(root / "current/web")
        retained_web = frontend.file_rows(root / "retained/web")
        commands = []
        checks = []

        result = frontend.set_web_retirement(
            True, root, site, command=commands.append,
            health=lambda retired, inventory: checks.append((retired, inventory["release"])),
        )
        retired = site.read_bytes()
        retired_http, retired_web, retired_telegram = retired.split(b"\nserver {\n")
        self.assertEqual(result, {"webRetired": True, "changed": True, "dryRun": False, "release": old["release"]})
        self.assertEqual(checks, [(True, old["release"])])
        self.assertEqual(commands, [["nginx", "-t"], ["systemctl", "reload", "nginx"]])
        self.assertEqual((retired_http, retired_telegram), (http, telegram))
        self.assertIn(b"# custom transport setting", retired_web)
        self.assertIn(b"ssl_certificate ", retired_web)
        self.assertIn(b"location / { return 302 https://t.me/InteriorsEditorBot?startapp; }", retired_web)
        self.assertIn(b"location = /sw.js", retired_web)
        self.assertIn(b"default_type application/javascript;", retired_web)
        self.assertIn(b"self.skipWaiting()", retired_web)
        self.assertIn(b"self.clients.claim()", retired_web)
        for absent in (b"caches.", b"indexedDB", b"Clear-Site-Data", b"/main.123.js", b"interiors-catalog-readonly.conf", b"try_files"):
            self.assertNotIn(absent, retired_web)
        self.assertEqual((root / "current").readlink().name, old["release"])
        self.assertEqual(frontend.file_rows(root / "current/web"), active_web)
        self.assertEqual(frontend.file_rows(root / "retained/web"), retained_web)

        def health(inventory):
            self.assertEqual(inventory["targets"], incoming["targets"])
            self.assertEqual(site.read_bytes().split(b"\nserver {\n")[1], retired_web)

        receipt = frontend.activate_telegram_release(
            archive, incoming["commit"], root=root, site=site, command=lambda _: None,
            ready=health, health=health,
        )
        next_telegram = site.read_bytes().split(b"\nserver {\n")[2]
        self.assertIn(b"/telegram.456.js", next_telegram)
        self.assertNotEqual(telegram, next_telegram)
        with self.assertRaisesRegex(ValueError, "retired"):
            frontend.activate_release(self.archive, root, site, command=lambda _: self.fail("changed nginx"))

        undo = frontend.set_web_retirement(False, root, site, command=lambda _: None,
                                           health=lambda *_: None)
        self.assertEqual(undo, {"webRetired": False, "changed": True, "dryRun": False, "release": receipt["release"]})
        self.assertEqual(site.read_bytes().split(b"\nserver {\n"), [http, web, next_telegram])
        self.assertEqual(frontend.file_rows(root / "current/web"), active_web)
        self.assertEqual(frontend.file_rows(root / "retained/web"), retained_web)

    def test_retirement_dry_run_and_replay_leave_config_alone(self):
        root, site, old, _, _ = self.telegram_update()
        original = site.read_bytes()
        dry_run = [str(MODULE), "retire-web", "--root", str(root), "--site", str(site), "--dry-run"]
        with patch.object(sys, "argv", dry_run), patch.object(frontend.os, "geteuid", return_value=1001), patch.object(sys, "stdout", io.StringIO()) as output:
            frontend.main()
        self.assertEqual(json.loads(output.getvalue()), {"webRetired": True, "changed": True, "dryRun": True, "release": old["release"]})
        self.assertEqual(site.read_bytes(), original)
        self.assertFalse((root / ".web-before-retirement.conf").exists())

        frontend.set_web_retirement(True, root, site, command=lambda _: None, health=lambda *_: None)
        retired = site.read_bytes()
        result = frontend.set_web_retirement(True, root, site,
                                             command=lambda _: self.fail("reloaded an unchanged configuration"),
                                             health=lambda *_: None)
        self.assertFalse(result["changed"])
        self.assertEqual(site.read_bytes(), retired)
        backup = root / ".web-before-retirement.conf"
        self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
        backup.write_bytes(backup.read_bytes() + b"# tampering\n")
        with self.assertRaisesRegex(ValueError, "rollback"):
            frontend.set_web_retirement(False, root, site, command=lambda _: self.fail("restored a tampered config"))
        self.assertEqual(site.read_bytes(), retired)

    def test_retirement_health_failure_restores_original_site_and_pointer(self):
        root, site, old, _, _ = self.telegram_update()
        original = site.read_bytes()
        commands = []

        def unhealthy(retired, inventory):
            self.assertTrue(retired)
            self.assertEqual(inventory, old)
            raise ValueError("public redirect mismatched")

        with self.assertRaisesRegex(ValueError, "public redirect mismatched"):
            frontend.set_web_retirement(True, root, site, command=commands.append, health=unhealthy)
        self.assertEqual(site.read_bytes(), original)
        self.assertEqual((root / "current").readlink().name, old["release"])
        self.assertEqual(commands, [["nginx", "-t"], ["systemctl", "reload", "nginx"]] * 2)

    def test_retirement_smoke_checks_worker_and_redirect_without_following_it(self):
        inventory = self.package()
        locations = []
        attempts = {"/sw.js": 0, "/main.123.js": 0}

        def public_response(origin, path, method="GET", headers=None, timeout=15, **options):
            self.assertEqual(origin, frontend.ORIGINS["web"])
            self.assertEqual(options, {"follow_redirects": False})
            self.assertEqual(headers, {"Cache-Control": "no-cache"})
            if path in attempts:
                attempts[path] += 1
            if path == "/sw.js":
                self.assertEqual(method, "GET")
                worker = frontend.WEB_RETIREMENT_WORKER if attempts[path] > 1 else b"old cached application worker"
                return 200, {"cache-control": "no-store", "content-type": "application/javascript"}, worker
            if path == "/main.123.js":
                self.assertEqual(method, "HEAD")
                if attempts[path] == 1:
                    return 200, {"cache-control": "public, max-age=31536000, immutable"}, b""
            if method == "POST":
                return 405, {}, b""
            if path in frontend.WITHDRAWN_CATALOG_PATHS:
                return 410, {}, b""
            locations.append(path)
            return 302, {"location": "https://t.me/InteriorsEditorBot?startapp", "cache-control": "no-store",
                         "referrer-policy": "no-referrer"}, b""

        with patch.object(frontend, "request", side_effect=public_response), patch.object(frontend.time, "sleep") as pause, patch.object(frontend, "smoke_release") as smoke:
            frontend.verify_web_retirement(True, inventory)
            smoke.assert_called_once_with({**inventory, "targets": {"telegram": inventory["targets"]["telegram"]}})
            self.assertEqual(pause.call_count, 2)
        self.assertIn("/?previous=deployment-check", locations)
        self.assertIn("/manifest.webmanifest", locations)
        self.assertIn("/main.123.js", locations)

    def test_telegram_activation_rolls_back_controls_on_failed_health(self):
        root, site, old, archive, incoming = self.telegram_update()
        last_receipt = (root / "last-deployment.json").read_bytes()
        previous_config = site.read_bytes()
        with self.assertRaisesRegex(ValueError, "source commit"):
            frontend.activate_telegram_release(archive, "f" * 40, root=root, site=site,
                                                command=lambda _: self.fail("nginx changed"))
        self.assertEqual(site.read_bytes(), previous_config)
        commands = []
        def failed_health(payload):
            self.assertEqual(payload["targets"], incoming["targets"])
            raise RuntimeError("public Telegram failed")
        with self.assertRaisesRegex(RuntimeError, "public Telegram failed"):
            frontend.activate_telegram_release(
                archive, incoming["commit"], root=root, site=site, command=commands.append,
                health=failed_health, ready=lambda _: None,
            )
        self.assertEqual((root / "current").readlink().name, old["release"])
        self.assertEqual((root / "last-deployment.json").read_bytes(), last_receipt)
        self.assertEqual(site.read_bytes().rpartition(b"\nserver {\n")[0],
                         previous_config.rpartition(b"\nserver {\n")[0])
        self.assertTrue((root / "retained/telegram/telegram.456.js").is_file())
        self.assertIn(b"/telegram.456.js", site.read_bytes())
        self.assertEqual(len(commands), 4)

    def test_telegram_activation_refuses_web_files_that_depart_from_the_active_inventory(self):
        root, site, old, archive, incoming = self.telegram_update()
        (root / "current/web/sw.js").write_bytes(b"not the published worker")
        before = site.read_bytes()
        with self.assertRaisesRegex(ValueError, "Published Web files differ"):
            frontend.activate_telegram_release(
                archive, incoming["commit"], root=root, site=site,
                command=lambda _: self.fail("nginx changed"),
            )
        self.assertEqual((root / "current").readlink().name, old["release"])
        self.assertEqual(site.read_bytes(), before)
        self.assertFalse((root / "retained/telegram/telegram.456.js").exists())

    def test_replaying_the_same_telegram_build_preserves_the_previous_release(self):
        root, site, old, archive, incoming = self.telegram_update()
        options = {"root": root, "site": site, "command": lambda _: None,
                   "health": lambda _: None, "ready": lambda _: None}
        first = frontend.activate_telegram_release(archive, incoming["commit"], **options)
        retry = frontend.activate_telegram_release(archive, incoming["commit"], **options)
        self.assertEqual(retry["previous"], "releases/" + old["release"])
        (root / "last-deployment.json").write_bytes(
            frontend.json_bytes({**first, "previous": "releases/" + first["release"],
                                 "rollbackRelease": "releases/" + old["release"]})
        )
        recovered = frontend.activate_telegram_release(archive, incoming["commit"], **options)
        self.assertEqual(recovered["previous"], "releases/" + old["release"])

    def test_telegram_activation_cli_calls_the_scoped_activation_entry(self):
        archive = self.base / "telegram.tar.gz"
        commit = "e" * 40
        site = self.base / "site.conf"
        args = [str(MODULE), "activate-telegram", "--archive", str(archive), "--commit", commit,
                "--root", str(self.base), "--site", str(site)]
        for override in ([], ["--enable-project-transfer-relay"]):
            with patch.object(sys, "argv", args + override), patch.object(frontend.os, "geteuid", return_value=0), patch.object(
                frontend.signal, "signal"
            ) as signals, patch.object(
                frontend, "activate_telegram_release", return_value={"deployed": True, "target": "telegram"}
            ) as activate, patch.object(sys, "stdout", io.StringIO()) as stdout:
                frontend.main()
            activate.assert_called_once_with(str(archive), commit, self.base, site,
                                             enable_project_transfer_relay=bool(override))
            self.assertEqual({call.args[0] for call in signals.call_args_list},
                             {frontend.signal.SIGINT, frontend.signal.SIGTERM})
            self.assertEqual(json.loads(stdout.getvalue()), {"deployed": True, "target": "telegram"})

    def test_telegram_smoke_requires_scoped_receipt_and_probes_only_telegram(self):
        root, site, _, archive, incoming = self.telegram_update()
        receipt = frontend.activate_telegram_release(
            archive, incoming["commit"], root=root, site=site,
            command=lambda _: None, health=lambda _: None, ready=lambda _: None,
        )
        receipt_path = self.base / "received.json"
        args = [str(MODULE), "smoke-telegram", "--archive", str(archive), "--receipt", str(receipt_path)]
        for field, value in (("target", "web"), ("commit", "f" * 40), ("telegramBuildId", "f" * 16),
                             ("webBuildId", "f" * 16), ("backendChanged", True), ("retainedAssetsDeleted", True)):
            receipt_path.write_text(json.dumps({**receipt, field: value}))
            with self.subTest(field=field), patch.object(sys, "argv", args), patch.object(
                frontend, "request", side_effect=AssertionError("request before receipt validation")
            ), self.assertRaisesRegex(ValueError, "receipt"):
                frontend.main()
        receipt_path.write_text(json.dumps(receipt))
        def telegram_request(origin, *args, **kwargs):
            self.assertEqual(origin, frontend.ORIGINS["telegram"])
            self.assertGreaterEqual(kwargs["timeout"], 45)
            return self.public_response(origin, *args, **kwargs)
        with patch.object(sys, "argv", args), patch.object(frontend, "request", side_effect=telegram_request), patch.object(
            sys, "stdout", io.StringIO()
        ) as stdout:
            frontend.main()
        self.assertEqual(json.loads(stdout.getvalue()), {
            "passed": True, "target": "telegram", "commit": incoming["commit"], "release": receipt["release"],
            "telegramBuildId": receipt["telegramBuildId"], "checks": 2 * len(incoming["targets"]["telegram"]) + 14,
        })

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
