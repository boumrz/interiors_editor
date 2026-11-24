"""Loopback relay for short-lived encrypted project files."""

from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import re
import secrets
from tempfile import TemporaryFile
from threading import BoundedSemaphore, Lock
import time
from typing import BinaryIO


UPLOAD_PATH = "/project-transfer/v1/files"
DOWNLOAD_PATH = re.compile(re.escape(UPLOAD_PATH) + r"/([A-Za-z0-9_-]{43})\Z")
MAGIC = b"INTENC1\n"
ENVELOPE_OVERHEAD = len(MAGIC) + 16 + 12 + 16  # salt, nonce, authentication tag
MAXIMUM_BYTES = 190 * 1024 * 1024 + ENVELOPE_OVERHEAD
CAPACITY_BYTES = 600 * 1024 * 1024
FILE_TTL_SECONDS = 900
MAXIMUM_ENTRIES = 256
MAXIMUM_CONNECTIONS = 16
CHUNK_BYTES = 256 * 1024
IDLE_TIMEOUT_SECONDS = 20
FORBIDDEN_UPLOAD_HEADERS = (
    "Authorization", "Cookie", "Content-Disposition", "X-Telegram-Init-Data",
    "X-User-Id", "X-File-Name",
)


@dataclass(frozen=True)
class StoredFile:
    handle: BinaryIO
    length: int
    expires: float


class BackupStore:
    """Owns anonymous file handles and budgets both active uploads and retained files."""

    def __init__(self, *, directory=None, capacity=CAPACITY_BYTES, maximum=MAXIMUM_BYTES, clock=time.monotonic):
        self.directory = directory
        self.maximum = maximum
        self.capacity = capacity
        self.clock = clock
        self.lock = Lock()
        self.files: dict[str, StoredFile] = {}
        self.used_bytes = 0
        self.in_flight = 0
        self.closed = False

    def _evict_expired(self):
        now = self.clock()
        for token in [token for token, stored in self.files.items() if stored.expires <= now]:
            stored = self.files.pop(token)
            self.used_bytes -= stored.length
            stored.handle.close()

    def evict_expired(self):
        with self.lock:
            self._evict_expired()

    def reserve(self, length):
        with self.lock:
            self._evict_expired()
            if (self.closed or self.used_bytes + length > self.capacity
                    or self.in_flight + len(self.files) >= MAXIMUM_ENTRIES):
                return False
            self.used_bytes += length
            self.in_flight += 1
            return True

    def abandon(self, length):
        with self.lock:
            self.used_bytes -= length
            self.in_flight -= 1

    def publish(self, handle, length):
        with self.lock:
            if self.closed:
                raise OSError("Upload interrupted")
            token = secrets.token_urlsafe(32)
            while token in self.files:
                token = secrets.token_urlsafe(32)
            self.files[token] = StoredFile(handle, length, self.clock() + FILE_TTL_SECONDS)
            self.in_flight -= 1
            return f"{UPLOAD_PATH}/{token}"

    def length(self, token):
        with self.lock:
            self._evict_expired()
            stored = self.files.get(token)
            return stored.length if stored else None

    def read_chunk(self, token, offset, length):
        with self.lock:
            self._evict_expired()
            stored = self.files.get(token)
            if stored is None:
                return b""
            # Positional reads let simultaneous Telegram requests share one handle.
            return os.pread(stored.handle.fileno(), length, offset)

    def close(self):
        with self.lock:
            self.closed = True
            for stored in self.files.values():
                stored.handle.close()
                self.used_bytes -= stored.length
            self.files.clear()


class RelayHandler(BaseHTTPRequestHandler):
    timeout = IDLE_TIMEOUT_SECONDS

    def log_message(self, _format, *_args):
        pass

    def send_error(self, code, message=None, explain=None):
        self._send(405 if code == HTTPStatus.NOT_IMPLEMENTED else code)

    def _send(self, status, *, content_length=0, headers=()):
        self.send_response_only(status)
        self.send_header("Content-Length", str(content_length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        for name, value in headers:
            self.send_header(name, value)
        self.end_headers()

    def _request_target(self):
        # BaseHTTPRequestHandler normalizes leading slashes in self.path.
        return self.requestline.split()[1]

    def _upload_length(self):
        if (self.headers.get_all("Transfer-Encoding") is not None
                or any(self.headers.get_all(name) is not None for name in FORBIDDEN_UPLOAD_HEADERS)):
            self._send(400)
            return None
        if self.headers.get_all("Content-Type") != ["application/octet-stream"]:
            self._send(415)
            return None
        lengths = self.headers.get_all("Content-Length")
        if lengths is None:
            self._send(411)
            return None
        if len(lengths) != 1 or re.fullmatch(r"[0-9]+", lengths[0]) is None:
            self._send(400)
            return None
        decimal_length = lengths[0].lstrip("0") or "0"
        if len(decimal_length) > 10 or int(decimal_length) > self.server.store.maximum:
            self._send(413)
            return None
        length = int(decimal_length)
        if length < ENVELOPE_OVERHEAD:
            self._send(400)
            return None
        return length

    def _read_part(self, maximum, deadline):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Upload deadline elapsed")
        self.connection.settimeout(min(remaining, IDLE_TIMEOUT_SECONDS))
        return self.rfile.read1(maximum)

    def _read_magic(self, deadline):
        prefix = bytearray()
        while len(prefix) < len(MAGIC):
            chunk = self._read_part(len(MAGIC) - len(prefix), deadline)
            if not chunk:
                return False
            prefix.extend(chunk)
        return prefix == MAGIC

    def _write_archive(self, handle, length, deadline):
        handle.write(MAGIC)
        remaining = length - len(MAGIC)
        while remaining:
            chunk = self._read_part(min(remaining, CHUNK_BYTES), deadline)
            if not chunk:
                return False
            handle.write(chunk)
            remaining -= len(chunk)
        handle.flush()
        return True

    def do_POST(self):
        if self._request_target() != UPLOAD_PATH:
            self._send(404)
            return
        length = self._upload_length()
        if length is None:
            return
        store = self.server.store
        if not store.reserve(length):
            self._send(503)
            return
        handle = None
        path = None
        status = 400
        try:
            deadline = time.monotonic() + FILE_TTL_SECONDS
            if self._read_magic(deadline):
                handle = TemporaryFile(dir=store.directory, mode="w+b")
                if self._write_archive(handle, length, deadline):
                    path = store.publish(handle, length)
        except TimeoutError:
            status = 408
        except OSError:
            status = 503
        finally:
            if path is None:
                if handle is not None:
                    try:
                        handle.close()
                    except OSError:
                        pass
                store.abandon(length)
        if path is None:
            self._send(status)
            return
        payload = json.dumps({"downloadPath": path}, separators=(",", ":")).encode("ascii")
        self._send(201, content_length=len(payload), headers=(("Content-Type", "application/json"),))
        self.wfile.write(payload)

    def _download(self, *, head):
        target = DOWNLOAD_PATH.fullmatch(self._request_target())
        store = self.server.store
        length = store.length(target[1]) if target else None
        if length is None:
            self._send(404)
            return
        self._send(200, content_length=length, headers=(
            ("Content-Type", "application/octet-stream"),
            ("Content-Disposition", 'attachment; filename="project.interiors"'),
            ("Access-Control-Allow-Origin", "https://web.telegram.org"),
            ("Access-Control-Expose-Headers", "Content-Disposition"),
        ))
        if head:
            return
        offset = 0
        while offset < length:
            chunk = store.read_chunk(target[1], offset, min(length - offset, CHUNK_BYTES))
            if not chunk:
                return
            self.wfile.write(chunk)
            offset += len(chunk)

    def do_HEAD(self):
        self._download(head=True)

    def do_GET(self):
        self._download(head=False)

class RelayServer(ThreadingHTTPServer):
    def __init__(self, address, store):
        super().__init__(address, RelayHandler)
        self.store = store
        self.connections = BoundedSemaphore(MAXIMUM_CONNECTIONS)

    def handle_error(self, _request, _client_address):
        # Default socketserver logging can expose client addresses.
        pass

    def process_request(self, request, client_address):
        if not self.connections.acquire(blocking=False):
            try:
                request.sendall(b"HTTP/1.0 503 Service Unavailable\r\nCache-Control: no-store\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            except OSError:
                pass
            finally:
                self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.connections.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.connections.release()

    def service_actions(self):
        self.store.evict_expired()


def main():
    store = BackupStore()
    try:
        with RelayServer(("127.0.0.1", 4182), store) as server:
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        store.close()


if __name__ == "__main__":
    main()
