"""Exercise the temporary encrypted file transport over a loopback socket."""

from concurrent.futures import ThreadPoolExecutor
from http.client import HTTPConnection
import json
from pathlib import Path
import re
from tempfile import TemporaryDirectory
from threading import Thread
import time
import unittest
from unittest.mock import patch

from scripts.deploy import project_backup_relay as relay


UPLOAD = "/project-transfer/v1/files"
ARCHIVE = b"INTENC1\n" + b"s" * 16 + b"n" * 12 + bytes(range(256)) + b"t" * 16
HEADERS = {"Content-Type": "application/octet-stream"}


class Clock:
    now = 100.0

    def __call__(self):
        return self.now


class RelayTests(unittest.TestCase):
    def start(self, *, capacity=2 * len(ARCHIVE), maximum=2 * len(ARCHIVE)):
        directory = self.enterContext(TemporaryDirectory())
        clock = Clock()
        store = relay.BackupStore(directory=directory, capacity=capacity, maximum=maximum, clock=clock)
        self.addCleanup(store.close)
        server = relay.RelayServer(("127.0.0.1", 0), store)
        self.addCleanup(server.server_close)
        thread = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        thread.start()
        self.addCleanup(thread.join, 2)
        self.addCleanup(server.shutdown)
        return server, clock

    def exchange(self, server, method, path, body=None, headers=None):
        connection = HTTPConnection(*server.server_address, timeout=3)
        try:
            connection.request(method, path, body=body, headers=headers or {})
            with connection.getresponse() as response:
                return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def post(self, server, body=ARCHIVE, headers=HEADERS, path=UPLOAD):
        return self.exchange(server, "POST", path, body, headers)

    def upload(self, server):
        status, headers, body = self.post(server)
        self.assertEqual(status, 201)
        self.assertEqual(headers["Cache-Control"], "no-store")
        result = json.loads(body)
        self.assertEqual(list(result), ["downloadPath"])
        path = result["downloadPath"]
        self.assertRegex(path, re.escape(UPLOAD) + r"/[A-Za-z0-9_-]{43}\Z")
        return path

    def test_head_and_repeated_parallel_get_are_byte_exact_until_expiry(self):
        server, clock = self.start()
        path = self.upload(server)
        self.assertFalse(list(Path(server.store.directory).iterdir()))
        clock.now += 899
        origin = {"Origin": "https://web.telegram.org"}
        head_status, head, empty = self.exchange(server, "HEAD", path, headers=origin)
        self.assertEqual((head_status, empty), (200, b""))
        self.assertEqual(head["Content-Type"], "application/octet-stream")
        self.assertEqual(head["Content-Length"], str(len(ARCHIVE)))
        self.assertEqual(head["Cache-Control"], "no-store")
        self.assertEqual(head["Content-Disposition"], 'attachment; filename="project.interiors"')
        self.assertEqual(head["Access-Control-Allow-Origin"], "https://web.telegram.org")
        with ThreadPoolExecutor(4) as pool:
            requests = [pool.submit(self.exchange, server, "GET", path) for _ in range(4)]
            for request in requests:
                status, headers, body = request.result()
                self.assertEqual((status, body), (200, ARCHIVE))
                self.assertEqual(headers, head)
        clock.now += 1
        self.assertEqual(self.exchange(server, "GET", path)[0], 404)
        self.assertEqual(self.exchange(server, "HEAD", path)[0], 404)

    def test_rejects_unencrypted_or_identified_inputs_and_noncanonical_targets(self):
        server, _ = self.start()
        self.assertEqual(self.post(server, b"PK\x03\x04" + ARCHIVE[4:])[0], 400)
        self.assertEqual(self.post(server, ARCHIVE[:51])[0], 400)
        self.assertEqual(self.post(server, headers={"Content-Type": "text/plain"})[0], 415)
        for name in ("Cookie", "Authorization", "Content-Disposition", "X-Telegram-Init-Data", "X-User-Id", "X-File-Name"):
            with self.subTest(name=name):
                self.assertEqual(self.post(server, headers={**HEADERS, name: "test-placeholder"})[0], 400)
        for path in (UPLOAD + "/", UPLOAD + "?name=sample", "/" + UPLOAD, UPLOAD.replace("files", "%66iles")):
            with self.subTest(path=path):
                self.assertEqual(self.post(server, path=path)[0], 404)
        token_path = self.upload(server)
        self.assertEqual(self.exchange(server, "GET", token_path + "?x")[0], 404)
        self.assertEqual(self.exchange(server, "GET", UPLOAD + "/" + "A" * 43)[0], 404)
        self.assertEqual(self.exchange(server, "DELETE", token_path)[0], 405)
        self.assertEqual(self.exchange(server, "PUT", token_path)[0], 405)

    def test_requires_length_and_rejects_oversize_before_reading_the_upload(self):
        server, _ = self.start(maximum=len(ARCHIVE))
        for lengths, transfer_encoding, expected in [([], None, 411), ([len(ARCHIVE) + 1], None, 413), ([len(ARCHIVE)] * 2, None, 400), ([], "chunked", 400)]:
            with self.subTest(lengths=lengths, encoding=transfer_encoding):
                connection = HTTPConnection(*server.server_address, timeout=2)
                try:
                    connection.putrequest("POST", UPLOAD)
                    for length in lengths:
                        connection.putheader("Content-Length", str(length))
                    if transfer_encoding:
                        connection.putheader("Transfer-Encoding", transfer_encoding)
                    connection.putheader("Content-Type", HEADERS["Content-Type"])
                    connection.endheaders()
                    with connection.getresponse() as response:
                        self.assertEqual(response.status, expected)
                finally:
                    connection.close()
        self.upload(server)

    def test_expired_files_release_budget_for_the_next_upload(self):
        server, clock = self.start(capacity=len(ARCHIVE))
        first = self.upload(server)
        self.assertEqual(self.post(server)[0], 503)
        clock.now += 900
        second = self.upload(server)
        self.assertNotEqual(first, second)
        self.assertEqual(self.exchange(server, "GET", first)[0], 404)
        self.assertEqual(self.exchange(server, "GET", second)[2], ARCHIVE)

    def test_incomplete_upload_releases_its_reservation(self):
        server, _ = self.start(capacity=len(ARCHIVE))
        partial = HTTPConnection(*server.server_address, timeout=2)
        try:
            partial.putrequest("POST", UPLOAD)
            partial.putheader("Content-Length", str(len(ARCHIVE)))
            partial.putheader("Content-Type", HEADERS["Content-Type"])
            partial.endheaders(ARCHIVE[:20])
            for _ in range(25):
                status, _, _ = self.post(server, b"invalid!" + ARCHIVE[8:52])
                if status == 503:
                    break
                time.sleep(0.01)
            self.assertEqual(status, 503)
        finally:
            partial.close()
        for _ in range(25):
            status, _, _ = self.post(server)
            if status != 503:
                break
            time.sleep(0.01)
        self.assertEqual(status, 201)

    def test_disk_failure_releases_budget_even_if_closing_the_file_fails(self):
        server, _ = self.start(capacity=len(ARCHIVE))

        class FailingWrite:
            def write(self, _data):
                raise OSError("No space")

            def close(self):
                raise OSError("No space while closing")

        with patch.object(relay, "TemporaryFile", return_value=FailingWrite()):
            self.assertEqual(self.post(server)[0], 503)
        self.upload(server)


if __name__ == "__main__":
    unittest.main()
