#!/usr/bin/env python3
"""Count empty Telegram signals and export closed Moscow reporting periods."""
import argparse
import datetime as dt
import http.client
import json
import os
import re
import socket
import socketserver
import sqlite3
import sys
import threading
from contextlib import closing, contextmanager
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

MOSCOW = ZoneInfo("Europe/Moscow")
PRIMARY = "114486792"
TMA_URL = "https://domiknote.ru/tma"
SERVICE_CID = "7000000000000000001"
INTRADAY_SERVICE_CID = "7000000000000000002"
PRODUCT_COUNTER = "114493478"
PRODUCT_URL = "https://domiknote.ru/tma-editor-report"
PRODUCT_GROUPS = {
    "projects": (
        "editor_entry", "project_created", "saved_project_opened", "room_created",
        "backup_prepared", "backup_handoff_requested", "backup_imported",
    ),
    "tools": (
        "wall_added", "wall_moved", "opening_added", "item_placed", "item_color_changed",
        "view_3d_ready", "undo_committed", "redo_committed",
    ),
    "errors": (
        "geometry_rejected", "item_collision", "opening_conflict", "save_quota", "save_failed",
        "storage_unavailable", "resource_missing", "resource_corrupt", "scene_unavailable",
        "scene_context_lost", "backup_invalid", "backup_incompatible", "backup_import_failed",
        "backup_export_failed", "backup_handoff_failed",
    ),
}
PRODUCT_PLATFORMS = ("ios", "android")
PRODUCT_CIDS = {
    ("projects", "ios"): "7000000000000000003",
    ("projects", "android"): "7000000000000000004",
    ("tools", "ios"): "7000000000000000005",
    ("tools", "android"): "7000000000000000006",
    ("errors", "ios"): "7000000000000000007",
    ("errors", "android"): "7000000000000000008",
}
PRODUCT_ROUTES = {
    f"/stats/tma-editor-v1/{platform}/{code}": (platform, code)
    for platform in PRODUCT_PLATFORMS for codes in PRODUCT_GROUPS.values() for code in codes
}
PRODUCT_HEALTH = "/health/tma-editor-v1"
RETRYABLE_DELIVERY = {"offline", "rejected"}
DATABASE = "/var/lib/interiors-analytics/counts.sqlite3"
OPEN = "/stats/tma-open-v2"
MOBILE_OPEN = "/stats/tma-mobile-open-v1"
REPEAT = "/stats/tma-repeat-v2"
RESEARCH_END = dt.datetime(2027, 3, 31, 21, tzinfo=dt.timezone.utc)
SLOT_SECONDS = 2 * 60 * 60
MAX_BACKDATE_SECONDS = 12 * 60 * 60


def slot_start(now):
    local = now.astimezone(MOSCOW)
    start = local.replace(hour=local.hour - local.hour % 2, minute=0, second=0, microsecond=0)
    return int(start.timestamp())


def moscow_instant(timestamp):
    return dt.datetime.fromtimestamp(timestamp, MOSCOW).isoformat()


def product_day_end(day):
    midnight = dt.datetime.combine(day + dt.timedelta(days=1), dt.time.min, tzinfo=MOSCOW)
    return midnight - dt.timedelta(seconds=1)


class Counts:
    def __init__(self, path, now=lambda: dt.datetime.now(MOSCOW)):
        self.path = path
        self.now = now

    @contextmanager
    def transaction(self):
        with closing(sqlite3.connect(self.path, timeout=5)) as db, db:
            db.execute("BEGIN IMMEDIATE")
            yield db

    def today(self):
        return self.now().astimezone(MOSCOW).date()

    def initialize(self):
        with self.transaction() as db:
            db.execute("CREATE TABLE IF NOT EXISTS counts (day TEXT PRIMARY KEY, opens INTEGER NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS exports (day TEXT PRIMARY KEY, state TEXT NOT NULL)")
            # Leave the previously installed counts and exports tables intact across upgrades.
            db.execute("CREATE TABLE IF NOT EXISTS repeat_counts (day TEXT PRIMARY KEY, opens INTEGER NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS intraday_activation (id INTEGER PRIMARY KEY CHECK(id = 1), start INTEGER NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS intraday_counts (start INTEGER PRIMARY KEY, opens INTEGER NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS intraday_exports (start INTEGER PRIMARY KEY, state TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS product_counts (day TEXT NOT NULL, platform TEXT NOT NULL, "
                       "code TEXT NOT NULL, total INTEGER NOT NULL, PRIMARY KEY (day, platform, code))")
            db.execute("CREATE TABLE IF NOT EXISTS product_exports (day TEXT NOT NULL, group_name TEXT NOT NULL, "
                       "platform TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY (day, group_name, platform))")
            # Establish the first observed day. Later closed days with no opens legitimately have zero.
            db.execute("INSERT INTO counts SELECT ?, 0 WHERE NOT EXISTS (SELECT 1 FROM counts)",
                       (self.today().isoformat(),))

    def increment(self, route):
        with self.transaction() as db:
            # Apply the cutoff *after* acquiring the lock: a queued write can cross midnight.
            now = self.now()
            day = now.astimezone(MOSCOW).date().isoformat()
            if route == REPEAT:
                if now >= RESEARCH_END:
                    return False
                table = "repeat_counts"
            elif route in (OPEN, MOBILE_OPEN):
                table = "counts"
            else:
                raise ValueError("Unknown counter")
            db.execute(f"INSERT INTO {table} (day, opens) VALUES (?, 1) "
                       "ON CONFLICT(day) DO UPDATE SET opens = opens + 1", (day,))
            if route == MOBILE_OPEN:
                start = slot_start(now)
                db.execute("INSERT INTO intraday_counts SELECT ?, 1 WHERE ? >= "
                           "(SELECT start FROM intraday_activation WHERE id = 1) "
                           "ON CONFLICT(start) DO UPDATE SET opens = opens + 1", (start, start))
            return True

    def increment_product(self, platform, code):
        with self.transaction() as db:
            day = self.today().isoformat()
            db.execute("INSERT INTO product_counts VALUES (?, ?, ?, 1) "
                       "ON CONFLICT(day, platform, code) DO UPDATE SET total = total + 1", (day, platform, code))
        return True

    @staticmethod
    def product_totals(db, day):
        return {(platform, code): total for platform, code, total in db.execute(
            "SELECT platform, code, total FROM product_counts WHERE day = ?", (day,)
        )}

    def product_report(self, day):
        date = day.isoformat()
        with closing(sqlite3.connect(self.path, timeout=5)) as db:
            earliest = db.execute("SELECT min(day) FROM product_counts").fetchone()[0]
            totals = self.product_totals(db, date)
            exports = {(group, platform): state for group, platform, state in db.execute(
                "SELECT group_name, platform, state FROM product_exports WHERE day = ?", (date,)
            )}
        if earliest is None or date < earliest:
            return []
        now = self.now().astimezone(MOSCOW)
        end = product_day_end(day)
        reports = []
        for group, platform in PRODUCT_CIDS:
            state = exports.get((group, platform), "open" if day >= now.date() else "pending")
            if state in RETRYABLE_DELIVERY | {"pending"} and now.timestamp() > end.timestamp() + MAX_BACKDATE_SECONDS:
                state = "expired"
            reports.append({"group": group, "platform": platform, "state": state,
                            "params": {code: totals.get((platform, code), 0) for code in PRODUCT_GROUPS[group]}})
        return reports

    def claim_product_export(self, day, group, platform):
        date = day.isoformat()
        with self.transaction() as db:
            now = self.now().timestamp()
            end = product_day_end(day).timestamp()
            if not end + 1 <= now <= end + MAX_BACKDATE_SECONDS:
                return "expired", None
            earliest = db.execute("SELECT min(day) FROM product_counts").fetchone()[0]
            if earliest is None or date < earliest:
                return "before-start", None
            row = db.execute("SELECT state FROM product_exports WHERE day = ? AND group_name = ? AND platform = ?",
                             (date, group, platform)).fetchone()
            if row and row[0] not in RETRYABLE_DELIVERY:
                return row[0], None
            db.execute("INSERT OR REPLACE INTO product_exports VALUES (?, ?, ?, 'sending')",
                       (date, group, platform))
            totals = dict(db.execute("SELECT code, total FROM product_counts WHERE day = ? AND platform = ?",
                                     (date, platform)))
            return "claimed", {code: totals.get(code, 0) for code in PRODUCT_GROUPS[group]}

    def finish_product_export(self, day, group, platform, state):
        with self.transaction() as db:
            db.execute("UPDATE product_exports SET state = ? WHERE day = ? AND group_name = ? AND platform = ? "
                       "AND state = 'sending'", (state, day.isoformat(), group, platform))

    def resolve_product_export(self, day, group, platform, state):
        if (group, platform) not in PRODUCT_CIDS or state not in {"sent", "rejected"}:
            raise ValueError("Unknown product report resolution")
        with self.transaction() as db:
            cursor = db.execute("UPDATE product_exports SET state = ? WHERE day = ? AND group_name = ? "
                                "AND platform = ? AND state IN ('unknown', 'sending')",
                                (state, day.isoformat(), group, platform))
            return cursor.rowcount == 1

    def activate_intraday(self):
        with self.transaction() as db:
            now = self.now()
            start = slot_start(now)
            if now.timestamp() > start:
                start += SLOT_SECONDS
            db.execute("INSERT OR IGNORE INTO intraday_activation VALUES (1, ?)", (start,))
            return moscow_instant(db.execute("SELECT start FROM intraday_activation WHERE id = 1").fetchone()[0])

    def intraday_report(self, day):
        now = self.now()
        begin = int(dt.datetime.combine(day, dt.time.min, tzinfo=MOSCOW).timestamp())
        with closing(sqlite3.connect(self.path, timeout=5)) as db:
            first = db.execute("SELECT start FROM intraday_activation WHERE id = 1").fetchone()
            last = min(begin + 24 * 60 * 60, slot_start(now))
            counts = dict(db.execute("SELECT start, opens FROM intraday_counts WHERE start >= ? AND start < ?", (begin, last)))
            exports = dict(db.execute("SELECT start, state FROM intraday_exports WHERE start >= ? AND start < ?", (begin, last)))
        if first is None:
            return []
        windows = []
        for start in range(max(begin, first[0]), last, SLOT_SECONDS):
            end = start + SLOT_SECONDS
            state = exports.get(start, "pending")
            if state in ("pending", "offline", "rejected") and now.timestamp() > end - 1 + MAX_BACKDATE_SECONDS:
                state = "expired"
            windows.append({"start": moscow_instant(start), "end": moscow_instant(end),
                            "tma_opens_2h": counts.get(start, 0), "state": state})
        return windows

    def claim_intraday(self, start):
        with self.transaction() as db:
            now = self.now().timestamp()
            end = start + SLOT_SECONDS
            if not end <= now <= end - 1 + MAX_BACKDATE_SECONDS:
                return None
            eligible = db.execute("SELECT 1 FROM intraday_activation WHERE id = 1 AND start <= ?", (start,)).fetchone()
            if eligible is None:
                return None
            row = db.execute("SELECT state FROM intraday_exports WHERE start = ?", (start,)).fetchone()
            if row and row[0] not in ("offline", "rejected"):
                return None
            db.execute("INSERT OR REPLACE INTO intraday_exports VALUES (?, 'sending')", (start,))
            count = db.execute("SELECT opens FROM intraday_counts WHERE start = ?", (start,)).fetchone()
            return count[0] if count else 0

    def finish_intraday(self, start, state):
        with self.transaction() as db:
            db.execute("UPDATE intraday_exports SET state = ? WHERE start = ?", (state, start))

    @staticmethod
    def daily_totals(db, day):
        return db.execute("SELECT coalesce((SELECT opens FROM counts WHERE day = ?), 0), "
                          "coalesce((SELECT opens FROM repeat_counts WHERE day = ?), 0)", (day, day)).fetchone()

    def totals(self, day):
        with closing(sqlite3.connect(self.path, timeout=5)) as db:
            return self.daily_totals(db, day)

    def claim_export(self, day):
        with self.transaction() as db:
            earliest = db.execute("SELECT min(day) FROM counts").fetchone()[0]
            if day < earliest:
                return "before-start", 0
            row = db.execute("SELECT state FROM exports WHERE day = ?", (day,)).fetchone()
            if row and row[0] not in ("offline", "rejected"):
                return row[0], 0
            db.execute("INSERT OR REPLACE INTO exports VALUES (?, 'sending')", (day,))
            return "claimed", self.daily_totals(db, day)

    def finish_export(self, day, state):
        with self.transaction() as db:
            db.execute("UPDATE exports SET state = ? WHERE day = ?", (state, day))


def send_hits(counter, token, hits):
    """Send a single bounded batch; classify failures without recording a URL, payload or provider body."""
    path = "/collect/?" + urlencode({"tid": counter, "ms": token})
    body = "\n".join(urlencode(hit) for hit in hits).encode("ascii")
    with closing(http.client.HTTPSConnection("mc.yandex.ru", timeout=4)) as conn:
        try:
            conn.connect()
        except (OSError, http.client.HTTPException):
            return "offline"
        try:
            conn.request("POST", path, body=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
            response = conn.getresponse()
            if response.status == 400:  # Protocol guarantees the batch was rejected.
                return "rejected"
            if response.status == 200 and response.read(129).strip() == b"<!-- OK -->":
                return "sent"
        except (OSError, http.client.HTTPException):
            pass
    return "unknown"


class Analytics:
    def __init__(self, store, env, send=send_hits):
        self.store = store
        self.env = env
        self.send = send

    def aggregate_enabled(self):
        return self.env.get("INTERIORS_AGGREGATE_AUTHORIZED", "1") == "1"

    def destination(self):
        counter = self.env.get("INTERIORS_MP_AGGREGATE_COUNTER_ID", "")
        token = self.env.get("INTERIORS_MP_AGGREGATE_TOKEN", "")
        if token and re.fullmatch(r"[1-9][0-9]{0,17}", counter) and counter != PRIMARY:
            return counter, token
        return None

    def product_enabled(self):
        return self.env.get("INTERIORS_PRODUCT_METRICS_ENABLED") == "1"

    def product_destination(self):
        destination = self.destination()
        return destination if destination and destination[0] == PRODUCT_COUNTER else None

    def record(self, route):
        product = PRODUCT_ROUTES.get(route)
        if product is not None:
            return self.product_enabled() and self.store.increment_product(*product)
        if not self.aggregate_enabled():
            return False
        if route == REPEAT and self.env.get("INTERIORS_REPEAT_ENABLED", "1") != "1":
            return False
        return self.store.increment(route)

    def export(self):
        if not self.aggregate_enabled():
            return "disabled"
        now = self.store.now().astimezone(MOSCOW)
        midnight = dt.datetime.combine(now.date(), dt.time.min, tzinfo=MOSCOW)
        end = midnight - dt.timedelta(seconds=1)
        day = end.date().isoformat()
        if now - end > dt.timedelta(hours=12):
            return "expired"
        destination = self.destination()
        if not destination:
            return "unconfigured"
        counter, token = destination
        status, totals = self.store.claim_export(day)
        if status != "claimed":
            return status
        opens, repeats = totals
        hit = {"cid": SERVICE_CID, "t": "pageview", "dl": TMA_URL + "/daily-report",
               "et": str(int(end.timestamp())), "params": json.dumps({"tma_opens": opens, "tma_repeat_opens": repeats}, separators=(",", ":"))}
        status = self.send(counter, token, [hit])
        self.store.finish_export(day, status)
        return status

    def export_product(self):
        if not self.product_enabled():
            return {"state": "disabled", "reports": []}
        now = self.store.now().astimezone(MOSCOW)
        day = now.date() - dt.timedelta(days=1)
        end = product_day_end(day)
        if now.timestamp() > end.timestamp() + MAX_BACKDATE_SECONDS:
            return {"state": "expired", "reports": []}
        destination = self.product_destination()
        if not destination:
            return {"state": "unconfigured", "reports": []}
        reports = []
        for (group, platform), cid in PRODUCT_CIDS.items():
            state, params = self.store.claim_product_export(day, group, platform)
            if state == "before-start":
                return {"state": state, "reports": []}
            if state == "claimed":
                hit = {"cid": cid, "t": "pageview", "dl": f"{PRODUCT_URL}/{group}/{platform}",
                       "et": str(int(end.timestamp())), "params": json.dumps(params, separators=(",", ":"))}
                state = self.send(*destination, [hit])
                self.store.finish_product_export(day, group, platform, state)
            reports.append({"group": group, "platform": platform, "state": state})
        return {"state": "ok" if all(row["state"] == "sent" for row in reports) else "needs-review",
                "day": day.isoformat(), "reports": reports}

    def export_intraday(self):
        if not self.aggregate_enabled():
            return {"state": "disabled", "windows": []}
        destination = self.destination()
        if not destination:
            return {"state": "unconfigured", "windows": []}
        counter, token = destination
        boundary = slot_start(self.store.now())
        windows = []
        for start in range(boundary - MAX_BACKDATE_SECONDS, boundary, SLOT_SECONDS):
            opens = self.store.claim_intraday(start)
            if opens is None:
                continue
            hit = {"cid": INTRADAY_SERVICE_CID, "t": "pageview", "dl": TMA_URL + "/intraday-report",
                   "et": str(start + SLOT_SECONDS - 1), "params": json.dumps({"tma_opens_2h": opens})}
            state = self.send(counter, token, [hit])
            self.store.finish_intraday(start, state)
            windows.append({"start": moscow_instant(start), "state": state})
        return {"state": "ok" if all(window["state"] == "sent" for window in windows) else "needs-review",
                "windows": windows}


class Handler(BaseHTTPRequestHandler):
    timeout = 5

    def log_message(self, *args):
        pass  # Even rejected request targets can contain arbitrary personal data.

    def reply(self, status):
        self.send_response_only(status)
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

    def do_GET(self):
        if self.path not in {"/health", "/health/aggregate-v2", "/health/mobile-open-v1", PRODUCT_HEALTH}:
            return self.reply(404)
        app = self.server.app
        try:
            today = app.store.today()
            if self.path == PRODUCT_HEALTH:
                if not app.product_destination():
                    return self.reply(503)
                app.store.product_report(today)
            else:
                app.store.totals(today.isoformat())
                if self.path != "/health" and (not app.aggregate_enabled() or not app.destination()):
                    return self.reply(503)
                if self.path == "/health/mobile-open-v1":
                    app.store.intraday_report(today)
        except sqlite3.Error:
            return self.reply(503)
        self.reply(204)

    def do_POST(self):
        product = self.path in PRODUCT_ROUTES
        if not product and self.path not in {OPEN, MOBILE_OPEN, REPEAT}:
            return self.reply(404)
        if self.headers.get_all("Content-Length") != ["0"] or "Transfer-Encoding" in self.headers:
            return self.reply(400)
        try:
            accepted = self.server.app.record(self.path)
        except (OSError, sqlite3.Error):
            return self.reply(503)
        self.reply(204 if accepted else 503 if product else 403)


class Server(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True

    def __init__(self, listener, app):
        # systemd owns the listening socket and its filesystem permissions.
        socketserver.BaseServer.__init__(self, listener.getsockname(), Handler)
        self.socket = listener
        self.app = app
        self.workers = threading.BoundedSemaphore(24)

    def process_request(self, request, client_address):
        if not self.workers.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.workers.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.workers.release()

    def handle_error(self, request, client_address):
        pass  # Tracebacks can expose untrusted request or transport metadata.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("serve")
    sub.add_parser("daily")
    sub.add_parser("intraday")
    sub.add_parser("activate-intraday")
    report = sub.add_parser("report")
    report.add_argument("--day", type=dt.date.fromisoformat)
    intraday_report = sub.add_parser("report-intraday")
    intraday_report.add_argument("--day", type=dt.date.fromisoformat)
    product_report = sub.add_parser("report-product")
    product_report.add_argument("--day", type=dt.date.fromisoformat)
    resolve_product = sub.add_parser("resolve-product")
    resolve_product.add_argument("--day", type=dt.date.fromisoformat, required=True)
    resolve_product.add_argument("--group", choices=PRODUCT_GROUPS, required=True)
    resolve_product.add_argument("--platform", choices=PRODUCT_PLATFORMS, required=True)
    resolve_product.add_argument("--confirmed", choices=("sent", "rejected"), required=True)
    args = parser.parse_args()
    store = Counts(os.environ.get("INTERIORS_ANALYTICS_DB", DATABASE))
    if args.action == "report":
        day = (args.day or store.today()).isoformat()
        opens, repeats = store.totals(day)
        print(json.dumps({"day": day, "tma_opens": opens, "tma_repeat_opens": repeats}))
        return 0
    if args.action == "report-intraday":
        day = args.day or store.today()
        print(json.dumps({"day": day.isoformat(), "windows": store.intraday_report(day)}))
        return 0
    if args.action == "report-product":
        day = args.day or store.today() - dt.timedelta(days=1)
        print(json.dumps({"day": day.isoformat(), "reports": store.product_report(day)}))
        return 0
    if args.action == "resolve-product":
        resolved = store.resolve_product_export(args.day, args.group, args.platform, args.confirmed)
        print(json.dumps({"resolved": resolved}))
        return 0 if resolved else 1
    store.initialize()
    app = Analytics(store, os.environ)
    if args.action == "daily":
        state = app.export()
        print(state)
        product = app.export_product()
        if product["state"] != "disabled":
            print(json.dumps(product))
        daily_ok = state in ("sent", "before-start", "disabled")
        product_ok = product["state"] in ("ok", "before-start", "disabled")
        return 0 if daily_ok and product_ok else 1
    if args.action == "activate-intraday":
        print(json.dumps({"first_window": store.activate_intraday()}))
        return 0
    if args.action == "intraday":
        result = app.export_intraday()
        print(json.dumps(result))
        return 0 if result["state"] in ("ok", "disabled") else 1
    if os.environ.get("LISTEN_PID") != str(os.getpid()) or os.environ.get("LISTEN_FDS") != "1":
        raise SystemExit("Start the collector using interiors-analytics.socket.")
    with Server(socket.socket(fileno=3), app) as server:
        server.serve_forever()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, sqlite3.Error):
        sys.exit("Analytics storage or socket unavailable.")
