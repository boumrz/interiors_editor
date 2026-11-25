"""Exercise the generated public routes through a local Nginx and a Unix socket."""
import datetime as dt
import http.client
import importlib.util
import json
import http.server
import os
from pathlib import Path
import re
import shutil
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import frontend

NGINX = os.environ.get("INTERIORS_NGINX_BIN") or shutil.which("nginx")
TOTAL = "/stats/tma-open-v2"
MOBILE_TOTAL = "/stats/tma-mobile-open-v1"
REPEAT = "/stats/tma-repeat-v2"
RETURN = "/stats/tma-return"
PRODUCT = "/stats/tma-editor-v1/ios/editor_entry"
PRODUCT_INTRADAY = "/stats/tma-editor-v2/editor_entry"


class ProductionRouteContract(unittest.TestCase):
    def test_generated_public_site_contains_no_personal_collector_route(self):
        config = frontend.nginx_site("/tmp/fixture", {"web": set(), "telegram": set()}).decode()
        self.assertNotIn("/stats/tma-return", config)
        self.assertIn("location = "+TOTAL+" {",config)
        self.assertIn("location = "+MOBILE_TOTAL+" {",config)
        self.assertIn("location = "+REPEAT+" {",config)
        self.assertIn("collect.sock",config)
        self.assertNotIn(PRODUCT, config)

    def test_only_product_capable_release_generates_the_aggregate_routes(self):
        config = frontend.nginx_site("/tmp/fixture", {"web": set(), "telegram": set()},
                                     product_metrics="tma-editor-v1").decode()
        telegram = config.split("server_name domiknote.ru;", maxsplit=1)[1]
        self.assertIn("location = " + PRODUCT + " {", telegram)
        self.assertIn("location = /stats/tma-editor-v1/android/backup_handoff_failed {", telegram)
        self.assertNotIn("location = /stats/tma-editor-v1/desktop/", telegram)
        self.assertNotIn("location = /health/tma-editor-v1", config)

    def test_collector_and_nginx_share_exactly_the_closed_product_catalog(self):
        source = Path(__file__).resolve().parents[1] / "analytics" / "collector.py"
        spec = importlib.util.spec_from_file_location("production_aggregate_catalog", source)
        collector = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(collector)
        for version, catalog in [("tma-editor-v1", collector.PRODUCT_ROUTES),
                                 ("tma-editor-v2", collector.PRODUCT_INTRADAY_ROUTES)]:
            config = frontend.nginx_site("/tmp/fixture", {"web": set(), "telegram": set()},
                                         product_metrics=version).decode()
            routed = re.findall(r"location = (/stats/tma-editor-v[12]/[a-z0-9_/]+) \{", config)
            self.assertCountEqual(routed, catalog.keys())

    def test_intraday_frontend_replaces_product_routes_and_keeps_relay_on_regeneration(self):
        paths = {"web": set(), "telegram": set()}
        previous = frontend.nginx_site("/tmp/fixture", paths, project_transfer_relay=True,
                                      product_metrics="tma-editor-v2")
        config = frontend.telegram_nginx_site("/tmp/fixture", set(), previous).decode()
        self.assertNotIn("/stats/tma-editor-v1/", config)
        self.assertNotIn("/health/tma-editor-v2", config)
        self.assertIn("location = " + frontend.PROJECT_TRANSFER_PATH + " {", config)
        self.assertIn("location = " + MOBILE_TOTAL + " {", config)
        routes = re.findall(r"location = (/stats/tma-editor-v2/[a-z0-9_/]+) \{", config)
        self.assertEqual(len(routes), 30)
        self.assertEqual(set(routes), {f"/stats/tma-editor-v2/{code}" for code in frontend.PRODUCT_METRIC_CODES})


@unittest.skipUnless(NGINX, "Set INTERIORS_NGINX_BIN or install Nginx to run this integration test")
class NginxFixture(unittest.TestCase):

    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="ie-nginx-", dir="/tmp")
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        self.calls = []
        calls = self.calls

        class Collector(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                headers = {k.lower(): v for k, v in self.headers.items()}
                body = self.rfile.read(int(headers["content-length"]))
                calls.append((self.path, headers, body))
                self.send_response(503 if body == b"f" * 64 else 204)
                self.send_header("Set-Cookie", "unwanted=value")
                self.end_headers()

        sock = root / "collector.sock"
        self.socket_path = str(sock)
        if getattr(self, "use_aggregate_collector", False):
            source = Path(__file__).resolve().parents[1] / "analytics" / "collector.py"
            spec = importlib.util.spec_from_file_location("production_aggregate_collector", source)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            self.clock = dt.datetime(2026,11,22,20,59,59,tzinfo=dt.timezone.utc)
            self.store = module.Counts(root/"counts.sqlite3", lambda: self.clock)
            self.store.initialize()
            self.reports = []
            self.app = module.Analytics(self.store, {"INTERIORS_MP_AGGREGATE_COUNTER_ID":"114493478",
                "INTERIORS_MP_AGGREGATE_TOKEN":"local-test"},
                lambda counter,token,hits: self.reports.append(hits) or "sent")
            collector = socketserver.UnixStreamServer(str(sock), module.Handler)
            collector.app = self.app
        else:
            collector = socketserver.UnixStreamServer(str(sock), Collector)
        thread = threading.Thread(target=collector.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(collector.server_close)
        self.addCleanup(collector.shutdown)

        with socket.socket() as reserved:
            reserved.bind(("127.0.0.1", 0))
            self.port = reserved.getsockname()[1]
        site = frontend.nginx_site(root, {"web": {"/index.html"}, "telegram": {"/index.html"}},
                                   product_metrics=getattr(self, "use_product_metrics", False)).decode()
        # Only adapt listeners, TLS/ACME, directories and the catalog include to local fixtures.
        site = "server {" + site.split("\nserver {", maxsplit=1)[1]
        site = site.replace("listen 443 ssl;", f"listen 127.0.0.1:{self.port};")
        site = re.sub(r'^    (listen \[::\]|ssl_).*$\n', "", site, flags=re.M)
        site = site.replace("/run/interiors-analytics/collect.sock", str(sock))
        site = site.replace("    include /etc/nginx/snippets/interiors-catalog-readonly.conf;",
                            "    location = /catalog-api/v1/catalogs/current { return 200; }")
        config = root / "nginx.conf"
        config.write_text(f"daemon off; master_process off; pid {root}/pid; error_log {root}/error.log;\n"
                          + "events {}\nhttp { access_log off; map $request_uri $invalid_frontend_path { default 0; }\n"
                          + f"client_body_temp_path {root}/client; proxy_temp_path {root}/proxy;\n" + site + "}\n")
        (root / "logs").mkdir()
        process = subprocess.Popen([NGINX, "-p", str(root), "-c", str(config)], stderr=subprocess.PIPE, text=True)
        def stop():
            process.terminate()
            process.communicate(timeout=5)
        self.addCleanup(stop)
        for _ in range(100):
            if process.poll() is not None:
                self.fail("Local Nginx startup failed: " + process.stderr.read())
            try:
                with socket.create_connection(("127.0.0.1", self.port), timeout=.3):
                    return
            except OSError:
                time.sleep(.03)
        self.fail("Nginx did not listen")

    def request(self, path, method="POST", body=b"", host="domiknote.ru", **overrides):
        headers = {"Host": host, "Origin": "https://domiknote.ru", "X-Interiors-Stats": "1",
                   "User-Agent": "private-ua", "Referer": "https://private.invalid/somewhere",
                   "Cookie": "secret=x", "Authorization": "Bearer private", "X-Forwarded-For": "192.0.2.9"}
        headers.update(overrides)
        headers = {k: v for k, v in headers.items() if v is not None}
        client = http.client.HTTPConnection("127.0.0.1", self.port, timeout=3)
        try:
            client.request(method, path, body=body, headers=headers)
            response = client.getresponse()
            self.assertIsNone(response.getheader("Set-Cookie"))
            response.read()
            return response.status
        finally:
            client.close()


class PublicNginxTests(NginxFixture):
    def test_old_and_current_clients_cannot_submit_to_default_public_routes(self):
        for path, payload in [('/stats/tma-open', b""), (RETURN, b"0"*64), (RETURN+"-v2", b"0"*160)]:
            self.assertEqual(self.request(path, body=payload), 405)
        self.assertEqual(self.calls, [])


class AggregateIngressTests(NginxFixture):

    def test_public_signals_reach_collector_without_client_headers(self):
        cid = b"0123456789abcdef" * 4
        self.assertEqual(self.request(TOTAL, Origin="null"), 204)
        self.assertEqual(self.request(MOBILE_TOTAL), 204)
        self.assertEqual(self.request(REPEAT), 204)
        self.assertGreaterEqual(self.request(RETURN, body=cid, **{"Content-Type":"text/plain"}),400)
        self.assertGreaterEqual(self.request(RETURN+"-v2",body=b"x"*160,**{"Content-Type":"text/plain"}),400)
        fixed = {"host": "localhost", "connection": "close"}
        self.assertEqual(self.calls, [
            (TOTAL, dict(fixed, **{"content-length": "0"}), b""),
            (MOBILE_TOTAL, dict(fixed, **{"content-length": "0"}), b""),
            (REPEAT,dict(fixed,**{"content-length":"0"}),b""),
        ])

    def test_invalid_requests_never_reach_collector(self):
        for path, options in [
            (REPEAT, {"Content-Length": None,"Transfer-Encoding":"chunked"}),
            (TOTAL, {"method": "GET"}), (TOTAL, {"method": "HEAD"}), (TOTAL, {"method": "OPTIONS"}),
            (TOTAL, {"body": b"extra"}), (REPEAT, {"body": b"id"}), (REPEAT+"?",{}), (TOTAL, {"Origin": "https://other.invalid"}),
            (MOBILE_TOTAL, {"body": b"extra"}), (MOBILE_TOTAL+"?", {}),
            (MOBILE_TOTAL, {"host": "www.domiknote.ru"}), (MOBILE_TOTAL+"/", {}),
            (TOTAL, {"X-Interiors-Stats": None}), (TOTAL, {"host": "www.domiknote.ru"}),
            (TOTAL + "?id=1", {}), (TOTAL + "/", {}), ("/stats/%74ma-open", {}),
            ("/index.html", {}), ("/catalog-api/v1/catalogs/current", {}),
            (RETURN, {"body": b"short", "Content-Type": "text/plain"}),
            (RETURN, {"body": b"a" * 64, "Content-Type": "application/json"}),
        ]:
            with self.subTest(path=path, options=options):
                self.assertIn(self.request(path, **options), (400, 403, 404, 405, 413, 415))
        self.assertEqual(self.calls, [])


class ProductIngressTests(NginxFixture):
    use_product_metrics = "tma-editor-v1"

    def test_only_fixed_platform_and_code_pairs_pass_without_client_headers_or_body(self):
        self.assertEqual(self.request(PRODUCT), 204)
        self.assertEqual(self.request("/stats/tma-editor-v1/android/save_quota"), 204)
        for path, options in [
            (PRODUCT, {"method": "GET"}),
            (PRODUCT, {"method": "OPTIONS"}),
            (PRODUCT, {"body": b"nonempty"}),
            (PRODUCT, {"Content-Length": None, "Transfer-Encoding": "chunked"}),
            (PRODUCT, {"Origin": "https://other.invalid"}),
            (PRODUCT, {"X-Interiors-Stats": None}),
            (PRODUCT, {"host": "www.domiknote.ru"}),
            (PRODUCT + "?", {}),
            (PRODUCT + "?private=1", {}),
            (PRODUCT + "/", {}),
            (PRODUCT.replace("/ios/", "/desktop/"), {}),
            (PRODUCT.replace("/ios/", "/%69os/"), {}),
            (PRODUCT.replace("editor_entry", "unrecognized"), {}),
            ("/health/tma-editor-v1", {"method": "GET"}),
        ]:
            with self.subTest(path=path, options=options):
                self.assertIn(self.request(path, **options), (400, 403, 404, 405, 413))
        self.assertEqual(self.calls, [
            (PRODUCT, {"host": "localhost", "connection": "close", "content-length": "0"}, b""),
            ("/stats/tma-editor-v1/android/save_quota",
             {"host": "localhost", "connection": "close", "content-length": "0"}, b""),
        ])


class ProductIntradayIngressTests(NginxFixture):
    use_product_metrics = "tma-editor-v2"

    def test_intraday_only_forwards_empty_closed_signals_without_platform(self):
        self.assertEqual(self.request(PRODUCT_INTRADAY), 204)
        self.assertEqual(self.request("/stats/tma-editor-v2/backup_handoff_failed", Origin="null"), 204)
        for path, options in [
            (PRODUCT, {}),
            (PRODUCT_INTRADAY.replace("/editor_entry", "/ios/editor_entry"), {}),
            (PRODUCT_INTRADAY.replace("/editor_entry", "/%65ditor_entry"), {}),
            (PRODUCT_INTRADAY.replace("editor_entry", "unrecognized"), {}),
            (PRODUCT_INTRADAY + "?", {}),
            (PRODUCT_INTRADAY + "?private=1", {}),
            (PRODUCT_INTRADAY + "/", {}),
            (PRODUCT_INTRADAY, {"body": b"private"}),
            (PRODUCT_INTRADAY, {"Content-Length": None, "Transfer-Encoding": "chunked"}),
            (PRODUCT_INTRADAY, {"Origin": "https://other.invalid"}),
            (PRODUCT_INTRADAY, {"X-Interiors-Stats": None}),
            (PRODUCT_INTRADAY, {"host": "www.domiknote.ru"}),
            (PRODUCT_INTRADAY, {"method": "GET"}),
            ("/health/tma-editor-v2", {"method": "GET"}),
        ]:
            with self.subTest(path=path, options=options):
                self.assertIn(self.request(path, **options), (400, 403, 404, 405, 413))
        headers = {"host": "localhost", "connection": "close", "content-length": "0"}
        self.assertEqual(self.calls, [
            (PRODUCT_INTRADAY, headers, b""),
            ("/stats/tma-editor-v2/backup_handoff_failed", headers, b""),
        ])

class AggregatePipelineTest(NginxFixture):
    use_aggregate_collector = True

    def test_deploy_readiness_forwarding_and_one_daily_report_in_the_real_service(self):
        frontend.verify_collector_ready(self.socket_path)
        self.assertEqual(self.request(TOTAL),204)
        self.assertEqual(self.request(REPEAT),204)
        self.assertEqual(self.request(RETURN,body=b"3"*64),405)
        self.assertEqual(self.reports,[])
        self.clock += dt.timedelta(minutes=10)
        self.assertEqual(self.app.export(),"sent")
        self.assertEqual(len(self.reports),1)
        self.assertEqual(json.loads(self.reports[0][0]["params"]),{"tma_opens":1,"tma_repeat_opens":1})
        self.app.env["INTERIORS_MP_AGGREGATE_TOKEN"] = ""
        with self.assertRaisesRegex(ValueError,"mobile-open-v1"):
            frontend.verify_collector_ready(self.socket_path)


class ProductPipelineTest(NginxFixture):
    use_aggregate_collector = True
    use_product_metrics = "tma-editor-v1"

    def test_private_preflight_stages_with_collection_off_then_exports_only_eligible_signals(self):
        frontend.verify_product_collector_ready(self.socket_path)
        self.assertEqual(self.request(PRODUCT), 503)
        self.assertEqual(self.request(MOBILE_TOTAL), 204)
        self.assertEqual(self.reports, [])
        self.app.env["INTERIORS_PRODUCT_METRICS_ENABLED"] = "1"
        self.assertEqual(self.request(PRODUCT), 204)
        self.assertGreaterEqual(self.request(PRODUCT + "?private=x"), 400)
        self.assertGreaterEqual(self.request(PRODUCT, body=b"private"), 400)
        self.clock += dt.timedelta(minutes=6)
        self.assertEqual(self.app.export(), "sent")
        self.assertEqual(self.app.export_product()["state"], "ok")
        self.assertEqual(len(self.reports), 7)
        self.assertEqual(json.loads(self.reports[0][0]["params"]), {"tma_opens": 1, "tma_repeat_opens": 0})
        self.assertEqual(json.loads(self.reports[1][0]["params"])["editor_entry"], 1)
        self.app.env["INTERIORS_MP_AGGREGATE_COUNTER_ID"] = "123"
        with self.assertRaisesRegex(ValueError, "tma-editor-v1"):
            frontend.verify_product_collector_ready(self.socket_path)


class ProductIntradayPipelineTest(NginxFixture):
    use_aggregate_collector = True
    use_product_metrics = "tma-editor-v2"

    def test_v2_preflight_requires_new_storage_and_the_collector_exports_only_closed_windows(self):
        with self.store.transaction() as db:
            db.execute("DROP TABLE product_intraday_exports")
        frontend.verify_product_collector_ready(self.socket_path, version="tma-editor-v1")
        with self.assertRaisesRegex(ValueError, "tma-editor-v2"):
            frontend.verify_product_collector_ready(self.socket_path, version="tma-editor-v2")
        self.store.initialize()

        frontend.verify_product_collector_ready(self.socket_path, version="tma-editor-v2")
        self.assertEqual(self.request(PRODUCT_INTRADAY), 503)
        self.assertEqual(self.request(MOBILE_TOTAL), 204)
        self.app.env["INTERIORS_PRODUCT_METRICS_ENABLED"] = "1"
        self.assertEqual(self.request(PRODUCT), 405)
        self.assertEqual(self.app.export_product_intraday(), {"state": "ok", "windows": []})
        self.assertEqual(self.request(PRODUCT_INTRADAY), 204)
        self.assertEqual(self.app.export_product_intraday(), {"state": "ok", "windows": []})
        self.assertEqual(self.reports, [])

        self.clock += dt.timedelta(minutes=6)
        self.assertEqual(self.app.export(), "sent")
        self.assertEqual(self.app.export_product()["reports"], [])
        self.assertEqual(self.app.export_product_intraday()["state"], "ok")
        reports = {hit["dl"]: json.loads(hit["params"]) for batch in self.reports for hit in batch}
        self.assertEqual(len(reports), 4)
        self.assertEqual(reports["https://domiknote.ru/tma-editor-report/projects/mobile"]["editor_entry"], 1)
