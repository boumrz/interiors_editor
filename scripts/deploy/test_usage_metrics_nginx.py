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
REPEAT = "/stats/tma-repeat-v2"
RETURN = "/stats/tma-return"


class ProductionRouteContract(unittest.TestCase):
    def test_generated_public_site_contains_no_personal_collector_route(self):
        config = frontend.nginx_site("/tmp/fixture", {"web": set(), "telegram": set()}).decode()
        self.assertNotIn("/stats/tma-return", config)
        self.assertIn("location = "+TOTAL+" {",config)
        self.assertIn("location = "+REPEAT+" {",config)
        self.assertIn("collect.sock",config)


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
        site = frontend.nginx_site(root, {"web": {"/index.html"}, "telegram": {"/index.html"}}).decode()
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

    def test_both_public_signals_reach_collector_without_client_headers(self):
        cid = b"0123456789abcdef" * 4
        self.assertEqual(self.request(TOTAL, Origin="null"), 204)
        self.assertEqual(self.request(REPEAT), 204)
        self.assertGreaterEqual(self.request(RETURN, body=cid, **{"Content-Type":"text/plain"}),400)
        self.assertGreaterEqual(self.request(RETURN+"-v2",body=b"x"*160,**{"Content-Type":"text/plain"}),400)
        fixed = {"host": "localhost", "connection": "close"}
        self.assertEqual(self.calls, [
            (TOTAL, dict(fixed, **{"content-length": "0"}), b""),
            (REPEAT,dict(fixed,**{"content-length":"0"}),b""),
        ])

    def test_invalid_requests_never_reach_collector(self):
        for path, options in [
            (REPEAT, {"Content-Length": None,"Transfer-Encoding":"chunked"}),
            (TOTAL, {"method": "GET"}), (TOTAL, {"method": "HEAD"}), (TOTAL, {"method": "OPTIONS"}),
            (TOTAL, {"body": b"extra"}), (REPEAT, {"body": b"id"}), (REPEAT+"?",{}), (TOTAL, {"Origin": "https://other.invalid"}),
            (TOTAL, {"X-Interiors-Stats": None}), (TOTAL, {"host": "www.domiknote.ru"}),
            (TOTAL + "?id=1", {}), (TOTAL + "/", {}), ("/stats/%74ma-open", {}),
            ("/index.html", {}), ("/catalog-api/v1/catalogs/current", {}),
            (RETURN, {"body": b"short", "Content-Type": "text/plain"}),
            (RETURN, {"body": b"a" * 64, "Content-Type": "application/json"}),
        ]:
            with self.subTest(path=path, options=options):
                self.assertIn(self.request(path, **options), (400, 403, 404, 405, 413, 415))
        self.assertEqual(self.calls, [])

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
        with self.assertRaisesRegex(ValueError,"aggregate-v2"):
            frontend.verify_collector_ready(self.socket_path)
