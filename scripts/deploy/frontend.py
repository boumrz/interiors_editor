#!/usr/bin/env python3
"""Exact, retained, rollback-safe frontend deployment. Python standard library only."""
import argparse
import fcntl
import hashlib
import http.client
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import signal
import socket
import tarfile
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

CONTROLS = {
    "/index.html", "/release-manifest.json", "/release-set.json", "/sw.js", "/manifest.webmanifest",
    "/legal/privacy-policy.html", "/legal/license-agreement.html", "/legal/analytics-consent.html",
    "/legal/product-analytics-consent.html",
}
ORIGINS = {"web": "https://www.domiknote.ru", "telegram": "https://domiknote.ru"}
# Historical release pools and immutable catalog versions keep their exact bytes.
# These URLs must remain closed even when an older release is retained.
WITHDRAWN_CATALOG_FILES = {
    "armchair-kursi-sofa.glb": "b4a730f48ae1d8ec04c94ef99534002d381afa258144464b4df8892889f34eed",
    "armchair-kursi-sofa.png": "8509df74641cd762851eff7ed493c1c931efd986752fe13d83ce9508ec311ec4",
    "wooden-cabinet.glb": "9dd295594623edf797cee3d4da1818802d723b404df51687d6ca1796f51b4608",
    "wooden-cabinet.png": "bded617fc7d3464f9102883d9da1d06ea76b0d76a230ae77feeeb78e9b8e83da",
    "zen-dining-chair.glb": "289c4d597eb5f38e7260afad2499d6e07a174261d613e8db28f260d40a0149e0",
    "zen-dining-chair.png": "11d2e14bea78f4e5961f5e02c3d24b80a3c4b4899ed55ac77d92d10af36e4e47",
}
WITHDRAWN_CATALOG_PATHS = {"/catalog/" + name for name in WITHDRAWN_CATALOG_FILES} | {
    "/catalog-api/v1/resources/sha256/" + digest for digest in WITHDRAWN_CATALOG_FILES.values()
}
MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES = 4096, 128 * 1024 * 1024, 1024 * 1024 * 1024
FRONTEND_ROOT = Path("/opt/interiors-editor/frontend")
FRONTEND_SITE = Path("/etc/nginx/sites-available/interiors-editor.conf")
WEB_RETIREMENT_LINK = "https://t.me/InteriorsEditorBot?startapp"
WEB_RETIREMENT_MARKER = b"    # interiors-web-retired-v1 "
WEB_RETIREMENT_WORKER = b'''self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.method === "GET" && event.request.mode === "navigate"
      && new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(fetch(event.request));
  }
});
'''
PROJECT_TRANSFER_PATH = "/project-transfer/v1/files"
MOBILE_OPEN_PATH = "/stats/tma-mobile-open-v1"
PRODUCT_METRIC_CONSENT = "/legal/2026-11-25/product-analytics-consent.html"
PRODUCT_METRIC_PREFIX = "/stats/tma-editor-v1/"
PRODUCT_METRIC_NGINX_MARKER = b"    # interiors-tma-editor-v1 product metrics"
PRODUCT_METRIC_PLATFORMS = ("ios", "android")
PRODUCT_METRIC_CODES = (
    "editor_entry", "project_created", "saved_project_opened", "room_created",
    "backup_prepared", "backup_handoff_requested", "backup_imported",
    "wall_added", "wall_moved", "opening_added", "item_placed", "item_color_changed",
    "view_3d_ready", "undo_committed", "redo_committed",
    "geometry_rejected", "item_collision", "opening_conflict", "save_quota", "save_failed",
    "storage_unavailable", "resource_missing", "resource_corrupt", "scene_unavailable",
    "scene_context_lost", "backup_invalid", "backup_incompatible", "backup_import_failed",
    "backup_export_failed", "backup_handoff_failed",
)
PROJECT_TRANSFER_TOKEN_PATTERN = "^" + PROJECT_TRANSFER_PATH + "/[A-Za-z0-9_-]{43}$"
PROJECT_TRANSFER_LIMIT_ZONES = (
    b"limit_req_zone $binary_remote_addr zone=interiors_project_transfer_requests:1m rate=6r/m;\n"
    b"limit_conn_zone $binary_remote_addr zone=interiors_project_transfer_connections:1m;\n"
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def safe_path(value):
    require(isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*", value), "Unsafe relative path")
    require(all(part not in (".", "..") for part in value.split("/")), "Unsafe path component")
    return value


def public_directory(path):
    """Set explicit modes on newly created directories, independent of root's umask."""
    require(not path.is_symlink(), "Linked public directory")
    if path.exists():
        require(path.is_dir(), "Expected public directory")
        return
    public_directory(path.parent)
    path.mkdir(mode=0o755)
    path.chmod(0o755)


def file_rows(directory):
    require(directory.is_dir() and not directory.is_symlink(), "Missing or linked build directory")
    rows = []
    total = 0
    for path in sorted(directory.rglob("*")):
        require(not path.is_symlink(), "Build contains symlink")
        if path.is_dir():
            continue
        require(path.is_file(), "Build contains special file")
        relative = safe_path(path.relative_to(directory).as_posix())
        size = path.stat().st_size
        total += size
        require(size <= MAX_FILE_BYTES and total <= MAX_TOTAL_BYTES and len(rows) < MAX_FILES, "Build exceeds deployment limits")
        rows.append({"path": "/" + relative, "byteLength": size, "sha256": sha(path.read_bytes())})
    return rows


def validate_target(directory, target, rows):
    paths = {row["path"] for row in rows}
    require({"/index.html", "/release-manifest.json"} <= paths, "Missing release controls")
    manifest = json.loads((directory / "release-manifest.json").read_bytes())
    build = manifest.get("appBuildId")
    require(isinstance(build, str) and re.fullmatch(r"[a-f0-9]{16}", build), "Invalid release identity")
    if target == "web":
        require({"/sw.js", "/manifest.webmanifest"} <= paths, "Web/PWA worker or manifest missing")
    else:
        require(not ({"/sw.js", "/manifest.webmanifest"} & paths), "Telegram must not contain PWA worker or manifest")
        release_set = json.loads((directory / "release-set.json").read_bytes())
        require(release_set.get("version") == 1 and release_set.get("deliveryTarget") == "telegram" and release_set.get("appBuildId") == build, "Telegram release metadata mismatch")
        require(isinstance(release_set.get("entryPath"), str) and re.fullmatch(r"/telegram\.[A-Za-z0-9_-]+\.js", release_set["entryPath"]) and release_set["entryPath"] in paths, "Missing exact Telegram entry")
        expected = sorted(release_set.get("assets", []), key=lambda row: row["path"])
        actual = sorted((row for row in rows if row["path"] != "/release-set.json"), key=lambda row: row["path"])
        require(expected == actual, "Telegram sealed inventory mismatch")
    return build


def package_release(web, telegram, output, commit):
    return _package_release({"web": Path(web), "telegram": Path(telegram)}, output, commit)


def package_telegram_release(telegram, output, commit):
    return _package_release({"telegram": Path(telegram)}, output, commit)


def _package_release(directories, output, commit):
    require(re.fullmatch(r"[a-f0-9]{40}", commit), "Expected full Git commit SHA")
    rows = {target: file_rows(directory) for target, directory in directories.items()}
    builds = {target: validate_target(directory, target, rows[target]) for target, directory in directories.items()}
    inventory = {"schemaVersion": 1, "commit": commit, "release": "--".join(builds.values()), "targets": rows}
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output, "w:gz") as archive:
        metadata = json_bytes(inventory)
        info = tarfile.TarInfo("inventory.json")
        info.size, info.mode = len(metadata), 0o644
        archive.addfile(info, io.BytesIO(metadata))
        for target, directory in directories.items():
            for row in rows[target]:
                relative = row["path"].lstrip("/")
                data = (directory / relative).read_bytes()
                require(len(data) == row["byteLength"] and sha(data) == row["sha256"], "Build changed while packaging")
                info = tarfile.TarInfo(target + "/" + relative)
                info.size, info.mode = len(data), 0o644
                archive.addfile(info, io.BytesIO(data))
    return inventory


def extract_release(archive_path, destination):
    return _extract_release(archive_path, destination, ("web", "telegram"))


def extract_telegram_release(archive_path, destination):
    return _extract_release(archive_path, destination, ("telegram",))


def _extract_release(archive_path, destination, targets):
    """Inspect every header before writing anything; never use extractall()."""
    destination = Path(destination)
    require(not destination.exists(), "Extraction target already exists")
    with tarfile.open(archive_path, "r:gz") as archive:
        members = {}
        total = 0
        for member in archive:
            safe_path(member.name)
            require(member.isfile() and member.name not in members, "Archive contains link, special file or duplicate")
            require(member.name == "inventory.json" or member.name.split("/", 1)[0] in targets, "Unknown archive target")
            total += member.size
            require(0 <= member.size <= MAX_FILE_BYTES and total <= MAX_TOTAL_BYTES and len(members) < MAX_FILES, "Archive exceeds deployment limits")
            members[member.name] = member
        require("inventory.json" in members and members["inventory.json"].size <= 4 * 1024 * 1024, "Missing or excessive inventory")
        inventory = json.loads(archive.extractfile(members["inventory.json"]).read())
        require(isinstance(inventory, dict) and set(inventory) == {"schemaVersion", "commit", "release", "targets"}
                and type(inventory["schemaVersion"]) is int and inventory["schemaVersion"] == 1, "Unknown inventory schema")
        require(isinstance(inventory["commit"], str) and re.fullmatch(r"[a-f0-9]{40}", inventory["commit"]), "Invalid source commit")
        require(isinstance(inventory["targets"], dict) and set(inventory["targets"]) == set(targets),
                "Archive targets do not match the deployment scope")
        expected = {"inventory.json"}
        for target, rows in inventory["targets"].items():
            require(isinstance(rows, list) and rows, "Empty inventory target")
            for row in rows:
                require(isinstance(row, dict) and set(row) == {"path", "byteLength", "sha256"}
                        and isinstance(row["path"], str) and row["path"].startswith("/"), "Invalid descriptor")
                name = target + "/" + safe_path(row["path"][1:])
                require(name not in expected and name in members, "Duplicate or missing inventory file")
                require(type(row["byteLength"]) is int and row["byteLength"] == members[name].size, "Inventory length mismatch")
                require(isinstance(row["sha256"], str) and re.fullmatch(r"[a-f0-9]{64}", row["sha256"]), "Invalid inventory digest")
                expected.add(name)
        require(set(members) == expected, "Uninventoried archive file")
        public_directory(destination)
        for target, rows in inventory["targets"].items():
            for row in rows:
                name = target + row["path"]
                data = archive.extractfile(members[name]).read()
                require(sha(data) == row["sha256"], "Archive content digest mismatch")
                path = destination / name
                public_directory(path.parent)
                path.write_bytes(data)
                path.chmod(0o644)
        (destination / "inventory.json").write_bytes(json_bytes(inventory))
        (destination / "inventory.json").chmod(0o644)
    builds = [validate_target(destination / target, target, inventory["targets"][target]) for target in targets]
    require(inventory["release"] == "--".join(builds), "Release identity mismatch")
    return inventory


def aggregate_stats_location(path):
    """Forward only an empty signal with freshly generated transport headers."""
    lines = [
        f"    location = {path} {{",
        '        if ($request_method != POST) { return 405; }',
        '        if ($http_x_interiors_stats != "1") { return 403; }',
        '        if ($http_origin !~ "^(https://domiknote[.]ru|null)?$") { return 403; }',
        '        if ($http_transfer_encoding != "") { return 400; }',
        '        client_max_body_size 64;',
        '        client_body_buffer_size 1k;',
        '        proxy_pass_request_headers off;',
        '        proxy_set_header Host localhost;',
        '        proxy_set_header Connection close;',
        '        proxy_next_upstream off;',
        '        proxy_connect_timeout 2s;',
        '        proxy_read_timeout 5s;',
        '        proxy_redirect off;',
        '        proxy_hide_header Set-Cookie;',
        '        proxy_hide_header Cache-Control;',
    ]
    lines.extend([
        '        if ($content_length !~ "^0?$") { return 400; }',
        '        proxy_pass_request_body off;',
        '        proxy_set_header Content-Length 0;',
    ])
    lines.extend([
        f"        proxy_pass http://unix:/run/interiors-analytics/collect.sock:{path};",
        "    }",
    ])
    return lines


def project_transfer_locations():
    upload = [
        f"    location = {PROJECT_TRANSFER_PATH} {{",
        f'        if ($request_uri != "{PROJECT_TRANSFER_PATH}") {{ return 404; }}',
        "        if ($request_method != POST) { return 405; }",
        "        client_max_body_size 199229492;",
        "        proxy_set_header Content-Type $content_type;",
        "        proxy_set_header Content-Length $content_length;",
    ]
    download = [
        f'    location ~ "{PROJECT_TRANSFER_TOKEN_PATTERN}" {{',
        f'        if ($request_uri !~ "{PROJECT_TRANSFER_TOKEN_PATTERN}") {{ return 404; }}',
        '        if ($request_method !~ "^(GET|HEAD)$") { return 405; }',
        "        proxy_pass_request_body off;",
        '        proxy_set_header Content-Length "";',
    ]
    relay = [
        "        access_log off;",
        "        error_log /dev/null crit;",
        "        limit_conn interiors_project_transfer_connections 4;",
        "        limit_conn_status 429;",
        "        limit_req zone=interiors_project_transfer_requests burst=12 nodelay;",
        "        limit_req_status 429;",
        "        proxy_http_version 1.1;",
        "        proxy_pass_request_headers off;",
        "        proxy_set_header Host 127.0.0.1;",
        '        proxy_set_header Connection "";',
        "        proxy_request_buffering off;",
        "        proxy_buffering off;",
        "        proxy_next_upstream off;",
        "        proxy_hide_header Cache-Control;",
        "        proxy_hide_header Set-Cookie;",
        "        proxy_pass http://127.0.0.1:4182;",
        "    }",
    ]
    return upload + relay + download + relay


def nginx_site(root, paths, *, project_transfer_relay=False, product_metrics=False):
    """Preserve the accepted HTTPS, ACME, read-only catalog and exact-path policy."""
    root = str(root)
    require(re.fullmatch(r"/[A-Za-z0-9_./-]+", root), "Unsafe frontend root")
    lines = ["server {", "    listen 80;", "    listen [::]:80;", "    server_name domiknote.ru www.domiknote.ru;", "    location ^~ /.well-known/acme-challenge/ {", "        root /var/lib/letsencrypt;", "        default_type text/plain;", "        try_files $uri =404;", "    }", "    location / { return 301 https://$host$request_uri; }", "}"]
    for target, origin in ORIGINS.items():
        lines.extend(["server {", "    listen 443 ssl;", "    listen [::]:443 ssl;", "    ssl_certificate /etc/letsencrypt/live/interiors-domiknote/fullchain.pem;", "    ssl_certificate_key /etc/letsencrypt/live/interiors-domiknote/privkey.pem;", "    ssl_protocols TLSv1.2 TLSv1.3;", "    server_name " + origin.split("//")[1] + ";", "    access_log off;", "    error_log /dev/null crit;"])
        if target == "telegram":
            # The complete original request target excludes query strings and URI aliases on writes.
            relay_path = "|" + PROJECT_TRANSFER_PATH if project_transfer_relay else ""
            product_path = ""
            if product_metrics:
                lines.append(PRODUCT_METRIC_NGINX_MARKER.decode())
                product_path = (f"|{PRODUCT_METRIC_PREFIX}({'|'.join(PRODUCT_METRIC_PLATFORMS)})/"
                                f"({'|'.join(PRODUCT_METRIC_CODES)})")
            lines.extend([
                '    set $frontend_method_path "$request_method:$request_uri";',
                '    if ($frontend_method_path !~ "^(GET:|HEAD:|POST:(/stats/tma-(open|repeat)-v2|' + MOBILE_OPEN_PATH
                + relay_path + product_path + ')$)") { return 405; }',
            ])
        else:
            lines.append("    if ($request_method !~ ^(GET|HEAD)$) { return 405; }")
        lines.extend(["    if ($invalid_frontend_path) { return 404; }", "    add_header X-Content-Type-Options nosniff always;", "    add_header Referrer-Policy no-referrer always;", "    add_header Cache-Control no-store always;", "    include /etc/nginx/snippets/interiors-catalog-readonly.conf;"])
        if target == "telegram":
            for path in ("/stats/tma-open-v2", MOBILE_OPEN_PATH, "/stats/tma-repeat-v2"):
                lines.extend(aggregate_stats_location(path))
            if product_metrics:
                for platform in PRODUCT_METRIC_PLATFORMS:
                    for code in PRODUCT_METRIC_CODES:
                        lines.extend(aggregate_stats_location(f"{PRODUCT_METRIC_PREFIX}{platform}/{code}"))
            if project_transfer_relay:
                lines.extend(project_transfer_locations())
        for path in sorted(WITHDRAWN_CATALOG_PATHS):
            lines.append("    location = " + path + " { return 410; }")
        for path in ["/"] + sorted(paths[target] - WITHDRAWN_CATALOG_PATHS):
            if path != "/":
                safe_path(path[1:])
            control = path == "/" or path in CONTROLS
            location_root = root + ("/current/" if control else "/retained/") + target
            cache = "no-store" if control else "public, max-age=31536000, immutable"
            lines.extend(["    location = " + path + " {", "        root " + location_root + ";", "        try_files " + ("/index.html" if path == "/" else path) + " =404;", "        etag " + ("off" if control else "on") + ";", "        if_modified_since " + ("off" if control else "exact") + ";", "        add_header X-Content-Type-Options nosniff always;", "        add_header Referrer-Policy no-referrer always;", '        add_header Cache-Control "' + cache + '" always;'])
            if target == "telegram" and path in {"/", "/index.html"}:
                lines.append("        add_header Content-Security-Policy \"frame-src 'none'\" always;")
            lines.append("    }")
        lines.extend(["    location / { return 404; }", "}"])
    config = ("\n".join(lines) + "\n").encode()
    return PROJECT_TRANSFER_LIMIT_ZONES + config if project_transfer_relay else config


def telegram_nginx_site(root, paths, current, *, enable_project_transfer_relay=False, product_metrics=None):
    """Replace only the final Telegram block of the installed managed site."""
    block = b"\nserver {\n"
    web, separator, telegram = current.rpartition(block)
    require(separator and b"\n    server_name www.domiknote.ru;\n" in web
            and b"\n    server_name domiknote.ru;\n" in telegram, "Unexpected installed frontend site")
    enabled = PROJECT_TRANSFER_LIMIT_ZONES in web
    if product_metrics is None:
        product_metrics = PRODUCT_METRIC_NGINX_MARKER in telegram
    replacement = nginx_site(root, {"web": set(), "telegram": paths},
                             project_transfer_relay=enabled or enable_project_transfer_relay,
                             product_metrics=product_metrics).rpartition(block)[2]
    prefix = PROJECT_TRANSFER_LIMIT_ZONES if enable_project_transfer_relay and not enabled else b""
    return prefix + web + separator + replacement


def retired_web_host(web):
    """Keep the HTTPS transport settings while replacing all Web editor routes."""
    method = b"    if ($request_method !~ ^(GET|HEAD)$) { return 405; }\n"
    transport, separator, _ = web.partition(method)
    require(separator, "Unexpected Web method policy")
    return b"".join((
        transport, method, WEB_RETIREMENT_MARKER, sha(web).encode(), b"\n",
        b"    if ($invalid_frontend_path) { return 404; }\n",
        b"    add_header X-Content-Type-Options nosniff always;\n",
        b"    add_header Referrer-Policy no-referrer always;\n",
        b"    add_header Cache-Control no-store always;\n",
        b"    location = /sw.js {\n",
        b"        default_type application/javascript;\n",
        b"        return 200 '", WEB_RETIREMENT_WORKER, b"';\n",
        b"    }\n",
        *(f"    location = {path} {{ return 410; }}\n".encode() for path in sorted(WITHDRAWN_CATALOG_PATHS)),
        b"    location / { return 302 ", WEB_RETIREMENT_LINK.encode(), b"; }\n",
        b"}\n",
    ))


def atomic_bytes(path, data, mode=0o644):
    descriptor, temporary = tempfile.mkstemp(prefix="." + path.name + ".", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def atomic_link(path, target):
    temporary = path.with_name(".next-current-" + str(os.getpid()))
    require(not temporary.exists() and not temporary.is_symlink(), "Existing pointer staging path")
    try:
        temporary.symlink_to(target)
        os.replace(temporary, path)
    finally:
        if temporary.is_symlink():
            temporary.unlink()


def run_command(arguments):
    subprocess.run(arguments, check=True, timeout=60)


def _verify_analytics_health(socket_path, version):
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(4)
        try:
            client.connect(socket_path)
            client.sendall(f"GET /health/{version} HTTP/1.0\r\nHost: localhost\r\n\r\n".encode("ascii"))
            with http.client.HTTPResponse(client) as response:
                response.begin()
                require(response.status == 204, f"Install and configure the {version} collector before release")
        except (OSError, http.client.HTTPException) as error:
            raise ValueError(f"The {version} collector is unavailable on its private socket") from error


def verify_collector_ready(socket_path="/run/interiors-analytics/collect.sock"):
    """Check compatibility on the private socket without creating a count or sending a report."""
    _verify_analytics_health(socket_path, "mobile-open-v1")


def verify_product_collector_ready(socket_path="/run/interiors-analytics/collect.sock"):
    """Check feature compatibility while the product collector can still be disabled."""
    _verify_analytics_health(socket_path, "tma-editor-v1")


def _carry_active_web(root, previous, staging, telegram):
    active = root / previous
    inventory_path = active / "inventory.json"
    require(not active.is_symlink() and not inventory_path.is_symlink() and inventory_path.is_file()
            and inventory_path.stat().st_size <= 4 * 1024 * 1024, "Missing installed release inventory")
    installed = json.loads(inventory_path.read_bytes())
    web_source = active / "web"
    web_rows = file_rows(web_source)
    web_build = validate_target(web_source, "web", web_rows)
    require(isinstance(installed, dict) and installed.get("release") == previous.name
            and re.fullmatch(web_build + r"--[a-f0-9]{16}", previous.name)
            and isinstance(installed.get("targets"), dict) and installed["targets"].get("web") == web_rows,
            "Published Web files differ from their inventory")
    shutil.copytree(web_source, staging / "web")
    require(file_rows(staging / "web") == web_rows, "Published Web files changed while copying")
    inventory = {
        **telegram, "release": web_build + "--" + telegram["release"],
        "targets": {"web": web_rows, **telegram["targets"]},
    }
    atomic_bytes(staging / "inventory.json", json_bytes(inventory))
    return inventory


def _telegram_previous_release(root, previous, release):
    """Keep the prior rollback pointer when publishing the same pair again."""
    if previous.name != release:
        return str(previous)
    web_build = release.split("--", 1)[0]
    journal = root / "last-deployment.json"
    try:
        if journal.is_symlink() or not journal.is_file() or journal.stat().st_size > 4 * 1024 * 1024:
            return str(previous)
        record = json.loads(journal.read_bytes())
    except (OSError, ValueError):
        return str(previous)
    if not isinstance(record, dict) or record.get("deployed") is not True or record.get("release") != release:
        return str(previous)
    for candidate in (record.get("previous"), record.get("rollbackRelease")):
        if (isinstance(candidate, str) and candidate != str(previous)
                and re.fullmatch("releases/" + web_build + r"--[a-f0-9]{16}", candidate)):
            directory = root / candidate
            if directory.is_dir() and not directory.is_symlink():
                return candidate
    return str(previous)


def _active_paired_inventory(root):
    pointer = root / "current"
    require(pointer.is_symlink(), "Expected existing atomic current pointer")
    relative = pointer.readlink()
    require(re.fullmatch(r"releases/[a-f0-9]{16}--[a-f0-9]{16}", str(relative)),
            "Expected an existing paired release")
    active = root / relative
    metadata = active / "inventory.json"
    require((root / "releases").is_dir() and not (root / "releases").is_symlink()
            and active.is_dir() and not active.is_symlink()
            and metadata.is_file() and not metadata.is_symlink()
            and metadata.stat().st_size <= 4 * 1024 * 1024, "Invalid active release inventory")
    inventory = json.loads(metadata.read_bytes())
    require(isinstance(inventory, dict) and inventory.get("release") == relative.name
            and isinstance(inventory.get("targets"), dict)
            and set(inventory["targets"]) == set(ORIGINS), "Invalid paired release inventory")
    for target, build in zip(ORIGINS, relative.name.split("--")):
        rows = file_rows(active / target)
        require(rows == inventory["targets"][target] and validate_target(active / target, target, rows) == build,
                "Active files differ from their inventory: " + target)
    return inventory


def _change_web_routes(retired, root, site, dry_run, command, health):
    inventory = _active_paired_inventory(root)
    current = site.read_bytes()
    boundary = b"\nserver {\n"
    blocks = current.rsplit(boundary, 2)
    require(len(blocks) == 3 and b"\n    server_name domiknote.ru www.domiknote.ru;\n" in blocks[0]
            and b"\n    server_name www.domiknote.ru;\n" in blocks[1]
            and b"\n    server_name domiknote.ru;\n" in blocks[2], "Unexpected installed frontend site")
    web = blocks[1]
    backup = root / ".web-before-retirement.conf"
    marker_count = web.count(WEB_RETIREMENT_MARKER)
    before = None
    if marker_count:
        require(marker_count == 1 and backup.is_file() and not backup.is_symlink()
                and backup.stat().st_size <= 4 * 1024 * 1024, "Missing or invalid Web rollback configuration")
        before = backup.read_bytes()
        require(WEB_RETIREMENT_MARKER not in before and b"\n    server_name www.domiknote.ru;\n" in before
                and retired_web_host(before) == web, "Web rollback configuration does not match the installed retirement")
    changed = retired != bool(marker_count)
    receipt = {"webRetired": retired, "changed": changed, "dryRun": dry_run, "release": inventory["release"]}
    if dry_run:
        return receipt
    if not changed:
        health(retired, inventory)
        return receipt
    if retired:
        blocks[1] = retired_web_host(web)
        require(not backup.is_symlink(), "Linked Web rollback configuration")
        atomic_bytes(backup, web, mode=0o600)
    else:
        blocks[1] = before
    atomic_bytes(site, boundary.join(blocks))
    try:
        command(["nginx", "-t"])
        command(["systemctl", "reload", "nginx"])
        health(retired, inventory)
    except BaseException:
        atomic_bytes(site, current)
        command(["nginx", "-t"])
        command(["systemctl", "reload", "nginx"])
        raise
    return receipt


def set_web_retirement(retired, root=FRONTEND_ROOT, site=FRONTEND_SITE, *,
                       dry_run=False, command=run_command, health=None):
    root, site = Path(root).absolute(), Path(site).absolute()
    require(root.is_dir() and not root.is_symlink(), "Existing frontend root required")
    require(site.is_file() and not site.is_symlink(), "Expected existing Nginx site file")
    verify = health or verify_web_retirement
    if dry_run:
        return _change_web_routes(retired, root, site, True, command, verify)
    with (root / ".project-deploy.lock").open("a") as project_lock:
        fcntl.flock(project_lock, fcntl.LOCK_EX)
        with (root / ".deploy.lock").open("a") as deploy_lock:
            fcntl.flock(deploy_lock, fcntl.LOCK_EX)
            return _change_web_routes(retired, root, site, False, command, verify)


def activate_telegram_release(archive, commit, root=FRONTEND_ROOT, site=FRONTEND_SITE, *,
                              command=run_command, health=None, ready=None, enable_project_transfer_relay=False):
    require(isinstance(commit, str) and re.fullmatch(r"[a-f0-9]{40}", commit), "Expected full source commit SHA")
    root = Path(root).absolute()
    require(root.is_dir() and not root.is_symlink(), "Existing frontend root required")
    # Keep the same lock order as a complete project deployment.
    with (root / ".project-deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        return _activate_release(archive, root, site, command, health, commit, ready, None,
                                 telegram_only=True, enable_project_transfer_relay=enable_project_transfer_relay)


def activate_release(archive, root, site, command=run_command, health=None, expected_commit=None, ready=None,
                     catalog_receipt=None):
    return _activate_release(archive, root, site, command, health, expected_commit, ready, catalog_receipt)


def _activate_release(archive, root, site, command, health, expected_commit, ready, catalog_receipt,
                      *, telegram_only=False, enable_project_transfer_relay=False):
    root, site = Path(root).absolute(), Path(site).absolute()
    require(root.is_dir() and not root.is_symlink(), "Existing frontend root required")
    require(site.is_file() and not site.is_symlink(), "Expected existing Nginx site file")
    require((root / "current").is_symlink(), "Expected existing atomic current pointer")
    with open(root / ".deploy.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        old_config = site.read_bytes()
        require(telegram_only or WEB_RETIREMENT_MARKER not in old_config,
                "Web is retired; activate a Telegram-only archive")
        previous = (root / "current").readlink()
        require(not previous.is_absolute() and previous.parts[0] == "releases" and len(previous.parts) == 2 and ".." not in previous.parts, "Unsafe current pointer")
        with tempfile.TemporaryDirectory(prefix=".staging-", dir=root) as work:
            staging = Path(work) / "release"
            extract = extract_telegram_release if telegram_only else extract_release
            inventory = extract(archive, staging)
            require(expected_commit is None or inventory["commit"] == expected_commit, "Archive source commit mismatch")
            if telegram_only:
                inventory = _carry_active_web(root, previous, staging, inventory)
            targets = {"telegram": inventory["targets"]["telegram"]} if telegram_only else inventory["targets"]
            public_inventory = {**inventory, "targets": targets}
            verify_collector_ready()
            product_metrics = any(row["path"] == PRODUCT_METRIC_CONSENT for row in targets["telegram"])
            if product_metrics:
                verify_product_collector_ready()
            retained = root / "retained"
            require(not retained.is_symlink(), "Linked retained pool")
            paths = {}
            # Check every collision before adding any new file or changing controls.
            for target, rows in targets.items():
                pool = retained / target
                if pool.exists():
                    old = file_rows(pool)
                    paths[target] = {row["path"] for row in old}
                else:
                    paths[target] = set()
                for row in rows:
                    path = row["path"]
                    if path in CONTROLS:
                        paths[target].add(path)
                        continue
                    existing = pool / path[1:]
                    require(not existing.exists() or (existing.is_file() and not existing.is_symlink() and sha(existing.read_bytes()) == row["sha256"]), "Immutable retained URL collision: " + target + path)
                    paths[target].add(path)
            relay_was_enabled = PROJECT_TRANSFER_LIMIT_ZONES in old_config
            if telegram_only:
                new_config = telegram_nginx_site(root, paths["telegram"], old_config,
                                                 enable_project_transfer_relay=enable_project_transfer_relay,
                                                 product_metrics=product_metrics)
            else:
                new_config = nginx_site(root, paths, project_transfer_relay=relay_was_enabled,
                                        product_metrics=product_metrics)
            release = root / "releases" / inventory["release"]
            public_directory(release.parent)
            require(not release.parent.is_symlink() and not release.is_symlink(), "Linked release storage")
            if release.exists():
                for target, rows in inventory["targets"].items():
                    require(file_rows(release / target) == rows, "Existing release identity has different files")
            else:
                os.replace(staging, release)
            for target, rows in targets.items():
                for row in rows:
                    if row["path"] in CONTROLS:
                        continue
                    path = retained / target / row["path"][1:]
                    public_directory(path.parent)
                    if not path.exists():
                        atomic_bytes(path, (release / target / row["path"][1:]).read_bytes())
            config_changed = False
            switched = False
            try:
                atomic_bytes(site, new_config)
                config_changed = True
                command(["nginx", "-t"])
                # New allowlisted immutable URLs are live before the new shell.
                command(["systemctl", "reload", "nginx"])
                (ready or wait_for_assets)(public_inventory)
                atomic_link(root / "current", "releases/" + inventory["release"])
                switched = True
                if health is not None:
                    health(public_inventory)
                else:
                    smoke_release(public_inventory, expected_catalog_digest=(
                        catalog_receipt["publicationSha256"] if catalog_receipt is not None else None))
                receipt = {"deployed": True, "commit": inventory["commit"], "release": inventory["release"], "previous": str(previous), "backendChanged": False, "retainedAssetsDeleted": False}
                if catalog_receipt is not None:
                    receipt.update(catalog=catalog_receipt, backendChanged=catalog_receipt["changed"])
                if telegram_only:
                    web_build, telegram_build = inventory["release"].split("--")
                    receipt.update(target="telegram", webBuildId=web_build, telegramBuildId=telegram_build,
                                   previous=_telegram_previous_release(root, previous, inventory["release"]))
                atomic_bytes(root / "last-deployment.json", json_bytes(receipt))
            except BaseException:
                if switched:
                    atomic_link(root / "current", previous)
                if config_changed:
                    # A shell may already be loaded. Keep its new immutable URLs
                    # alongside the old ones after reverting the active controls.
                    restored_config = new_config if switched else old_config
                    if switched and enable_project_transfer_relay and not relay_was_enabled:
                        restored_config = telegram_nginx_site(root, paths["telegram"], old_config)
                    atomic_bytes(site, restored_config)
                    command(["nginx", "-t"])
                    command(["systemctl", "reload", "nginx"])
                raise
            return receipt


class _RejectRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def request(origin, path, method="GET", headers=None, timeout=15, *, follow_redirects=True):
    deadline = time.monotonic() + timeout
    open_request = urlopen if follow_redirects else build_opener(_RejectRedirect()).open
    try:
        response = open_request(Request(origin + path, method=method, headers=headers or {}), timeout=timeout)
    except HTTPError as error:
        response = error
    with response:
        require(response.geturl() == origin + path, "Unexpected public redirect")
        body = bytearray()
        read_chunk = getattr(response, "read1", response.read)
        while len(body) <= MAX_FILE_BYTES:
            require(time.monotonic() < deadline, "Public response deadline exceeded")
            chunk = read_chunk(min(64 * 1024, MAX_FILE_BYTES + 1 - len(body)))
            if not chunk:
                break
            body.extend(chunk)
        require(len(body) <= MAX_FILE_BYTES, "Public response exceeds deployment limit")
        return response.status, {key.lower(): value for key, value in response.headers.items()}, bytes(body)


def valid_mime(path, headers):
    allowed = {".html": {"text/html"}, ".js": {"application/javascript", "text/javascript"}, ".css": {"text/css"}, ".json": {"application/json"}, ".svg": {"image/svg+xml"}, ".png": {"image/png"}, ".glb": {"model/gltf-binary", "application/octet-stream"}, ".webmanifest": {"application/manifest+json", "application/octet-stream"}, ".txt": {"text/plain"}}
    content_type = headers.get("content-type", "").split(";", 1)[0].strip().lower()
    return content_type in allowed.get(Path(path).suffix, {"application/octet-stream"})


def wait_for_assets(inventory, timeout_seconds=60):
    """Observe every new immutable URL after asynchronous Nginx reload, before switch."""
    deadline = time.monotonic() + timeout_seconds
    last_error = "not yet checked"
    while True:
        require(time.monotonic() < deadline, "Immutable readiness deadline exceeded: " + last_error)
        try:
            for target, rows in inventory["targets"].items():
                for row in rows:
                    if row["path"] in CONTROLS:
                        continue
                    remaining = deadline - time.monotonic()
                    require(remaining > 0, "Immutable readiness deadline exceeded")
                    status, headers, data = request(ORIGINS[target], row["path"], "HEAD", timeout=min(5, remaining))
                    require(status == 200 and not data and headers.get("content-length") == str(row["byteLength"]) and headers.get("cache-control") == "public, max-age=31536000, immutable" and valid_mime(row["path"], headers), "Immutable URL not ready: " + target + row["path"])
            return
        except (ValueError, OSError) as error:
            last_error = str(error)
            remaining = deadline - time.monotonic()
            require(remaining > 0, "Immutable readiness deadline exceeded: " + last_error)
            time.sleep(min(0.25, remaining))


def receipt_catalog_digest(inventory, receipt):
    require(isinstance(receipt, dict) and receipt.get("deployed") is True
            and receipt.get("commit") == inventory["commit"] and receipt.get("release") == inventory["release"],
            "Deployment receipt does not match this release")
    catalog = receipt.get("catalog")
    digest = catalog.get("publicationSha256") if isinstance(catalog, dict) else None
    require(isinstance(digest, str) and re.fullmatch(r"[a-f0-9]{64}", digest),
            "Deployment receipt has no valid catalog publication digest")
    return digest


def telegram_smoke_inventory(inventory, receipt):
    require(isinstance(receipt, dict) and receipt.get("deployed") is True and receipt.get("target") == "telegram"
            and receipt.get("commit") == inventory["commit"] and receipt.get("telegramBuildId") == inventory["release"]
            and receipt.get("backendChanged") is False and receipt.get("retainedAssetsDeleted") is False,
            "Telegram deployment receipt does not match this release")
    web_build = receipt.get("webBuildId")
    require(isinstance(web_build, str) and re.fullmatch(r"[a-f0-9]{16}", web_build)
            and receipt.get("release") == web_build + "--" + inventory["release"],
            "Telegram deployment receipt has an invalid paired release")
    return {**inventory, "release": receipt["release"]}


def smoke_release(inventory, timeout_seconds=None, expected_catalog_digest=None):
    telegram_only = inventory["targets"].keys() == {"telegram"}
    if timeout_seconds is None:
        timeout_seconds = 360 if telegram_only else 180
    # Telegram's signed release includes large GLBs. Keep an overall deadline
    # while allowing slower HTTPS transfers a larger per-file share of it.
    request_timeout = 60 if telegram_only else 15
    deadline = time.monotonic() + timeout_seconds
    def probe(origin, path, method="GET", headers=None):
        remaining = deadline - time.monotonic()
        require(remaining > 0, "Public health-check deadline exceeded")
        return request(origin, path, method, headers, timeout=min(request_timeout, remaining))
    checks = 0
    for target, rows in inventory["targets"].items():
        origin = ORIGINS[target]
        for row in rows:
            path = row["path"]
            status, headers, data = probe(origin, path)
            require(status == 200 and len(data) == row["byteLength"] and sha(data) == row["sha256"], "Public bytes mismatch: " + target + path)
            require(valid_mime(path, headers), "Public MIME mismatch: " + target + path)
            cache = "no-store" if path in CONTROLS else "public, max-age=31536000, immutable"
            require(headers.get("cache-control") == cache and headers.get("x-content-type-options") == "nosniff" and headers.get("referrer-policy") == "no-referrer" and "set-cookie" not in headers, "Public delivery headers mismatch")
            status, headers, data = probe(origin, path, "HEAD")
            require(status == 200 and not data and headers.get("content-length") == str(row["byteLength"]) and headers.get("cache-control") == cache, "Public HEAD mismatch")
            checks += 2
        status, _, data = probe(origin, "/?tgWebAppStartParam=deployment%20check")
        index = next(row for row in rows if row["path"] == "/index.html")
        require(status == 200 and sha(data) == index["sha256"], "Public root mismatch")
        for path in ("/unknown-deployment-check.js", "/.git/config", "/%69ndex.html", "//index.html"):
            require(probe(origin, path)[0] == 404, "Unknown/noncanonical path accepted")
        require(probe(origin, "/", "POST")[0] == 405, "Public mutation accepted")
        asset = next(row for row in rows if row["path"].endswith(".js") and row["byteLength"] >= 4)
        status, headers, data = probe(origin, asset["path"], headers={"Range": "bytes=0-3"})
        require(status == 206 and len(data) == 4 and headers.get("content-range") == "bytes 0-3/" + str(asset["byteLength"]), "Public byte range mismatch")
        status, headers, data = probe(origin, "/catalog-api/v1/catalogs/current", headers={"Accept": "application/json"})
        require(status == 200 and isinstance(json.loads(data).get("catalogVersion"), str), "Read-only catalog unavailable")
        if expected_catalog_digest is not None:
            require(sha(data) == expected_catalog_digest and headers.get("etag") == '"' + expected_catalog_digest + '"',
                    "Public catalog publication digest mismatch")
        require(probe(origin, "/catalog-api/v1/catalogs/current?unexpected=1")[0] == 404, "Catalog query accepted")
        require(probe(origin, "/catalog-api/v1/catalogs/current", headers={"Cookie": "synthetic=1"})[0] == 400, "Catalog cookie accepted")
        require(probe(origin, "/catalog-api/v1/catalogs/current", headers={"Authorization": "Bearer synthetic"})[0] == 400, "Catalog authorization accepted")
        require(probe(origin, "/catalog-api/v1/catalogs/current", "POST")[0] == 405, "Catalog write accepted")
        checks += 12
    for path in ("/sw.js", "/manifest.webmanifest"):
        require(probe(ORIGINS["telegram"], path)[0] == 404, "Telegram exposes browser worker/manifest")
    return {"passed": True, "release": inventory["release"], "checks": checks + 2}


def wait_for_retired_web(inventory, timeout_seconds=25):
    """Wait for the new Nginx workers to replace the old public routes."""
    origin = ORIGINS["web"]
    deadline = time.monotonic() + timeout_seconds
    public_routes = ({"/catalog-api/v1/catalogs/current"}
                     | {row["path"] for row in inventory["targets"]["web"] if row["path"] != "/sw.js"})

    def probe(path, method="HEAD"):
        remaining = deadline - time.monotonic()
        require(remaining > 0, "Web retirement readiness deadline exceeded")
        return request(origin, path, method, headers={"Cache-Control": "no-cache"},
                       timeout=min(5, remaining), follow_redirects=False)

    def check_redirect(path, method="HEAD"):
        status, headers, _ = probe(path, method)
        require(status == 302 and headers.get("location") == WEB_RETIREMENT_LINK
                and headers.get("cache-control") == "no-store" and headers.get("referrer-policy") == "no-referrer",
                f"Web retirement redirect mismatch (HTTP {status}): {path}")

    while True:
        try:
            status, headers, worker = probe("/sw.js", "GET")
            require(status == 200 and valid_mime("/sw.js", headers) and worker == WEB_RETIREMENT_WORKER
                    and headers.get("cache-control") == "no-store", f"Web retirement worker mismatch (HTTP {status})")
            check_redirect("/?previous=deployment-check", "GET")
            for path in sorted(public_routes - WITHDRAWN_CATALOG_PATHS):
                check_redirect(path)
            for path in sorted(WITHDRAWN_CATALOG_PATHS):
                require(probe(path)[0] == 410, "Withdrawn Web resource is no longer blocked: " + path)
            require(probe("/", "POST")[0] == 405, "Unexpected Web write route")
            return
        except (ValueError, OSError) as error:
            remaining = deadline - time.monotonic()
            require(remaining > 0, "Web retirement readiness deadline exceeded: " + str(error))
            time.sleep(min(0.25, remaining))


def verify_web_retirement(retired, inventory):
    if not retired:
        smoke_release(inventory)
        return
    wait_for_retired_web(inventory)
    smoke_release({**inventory, "targets": {"telegram": inventory["targets"]["telegram"]}})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    package = commands.add_parser("package")
    package.add_argument("--web", required=True)
    for command in (package, commands.add_parser("package-telegram")):
        for option in ("telegram", "output", "commit"):
            command.add_argument("--" + option, required=True)
    for name in ("activate", "activate-telegram"):
        activate = commands.add_parser(name)
        activate.add_argument("--archive", required=True)
        activate.add_argument("--commit", required=True)
        activate.add_argument("--root", default=FRONTEND_ROOT, type=Path)
        activate.add_argument("--site", default=FRONTEND_SITE, type=Path)
        if name == "activate-telegram":
            activate.add_argument("--enable-project-transfer-relay", action="store_true")
    for name in ("retire-web", "restore-web"):
        route_change = commands.add_parser(name)
        route_change.add_argument("--root", default=FRONTEND_ROOT, type=Path)
        route_change.add_argument("--site", default=FRONTEND_SITE, type=Path)
        route_change.add_argument("--dry-run", action="store_true")
    for name in ("smoke", "smoke-telegram"):
        smoke = commands.add_parser(name)
        smoke.add_argument("--archive", required=True)
        smoke.add_argument("--receipt", type=Path, required=name == "smoke-telegram")
    arguments = parser.parse_args()
    if arguments.command in ("activate", "activate-telegram") or (
            arguments.command in ("retire-web", "restore-web") and not arguments.dry_run):
        require(os.geteuid() == 0, "Activation requires the pre-provisioned privileged deployment service")

        def interrupted(signum, _frame):
            raise InterruptedError("Deployment interrupted by signal " + str(signum))

        signal.signal(signal.SIGTERM, interrupted)
        signal.signal(signal.SIGINT, interrupted)
    if arguments.command == "package":
        result = package_release(arguments.web, arguments.telegram, arguments.output, arguments.commit)
        print(json.dumps({"packaged": True, "commit": result["commit"], "release": result["release"]}))
    elif arguments.command == "package-telegram":
        result = package_telegram_release(arguments.telegram, arguments.output, arguments.commit)
        print(json.dumps({"packaged": True, "target": "telegram", "commit": result["commit"], "release": result["release"]}))
    elif arguments.command in ("activate", "activate-telegram"):
        require(re.fullmatch(r"[a-f0-9]{40}", arguments.commit), "Expected full source commit SHA")
        if arguments.command == "activate-telegram":
            receipt = activate_telegram_release(arguments.archive, arguments.commit, arguments.root, arguments.site,
                                                enable_project_transfer_relay=arguments.enable_project_transfer_relay)
        else:
            receipt = activate_release(arguments.archive, arguments.root, arguments.site, expected_commit=arguments.commit)
        print(json.dumps(receipt))
    elif arguments.command in ("retire-web", "restore-web"):
        result = set_web_retirement(arguments.command == "retire-web", arguments.root, arguments.site,
                                    dry_run=arguments.dry_run)
        print(json.dumps(result))
    elif arguments.command == "smoke-telegram":
        with tempfile.TemporaryDirectory(prefix="interiors-telegram-smoke-") as temporary:
            inventory = extract_telegram_release(arguments.archive, Path(temporary) / "release")
            receipt = json.loads(arguments.receipt.read_bytes())
            result = smoke_release(telegram_smoke_inventory(inventory, receipt))
            print(json.dumps({**result, "target": "telegram", "commit": inventory["commit"],
                              "telegramBuildId": inventory["release"]}))
    else:
        with tempfile.TemporaryDirectory(prefix="interiors-deploy-smoke-") as temporary:
            result = extract_release(arguments.archive, Path(temporary) / "release")
            digest = receipt_catalog_digest(result, json.loads(arguments.receipt.read_bytes())) if arguments.receipt else None
            print(json.dumps(smoke_release(result, expected_catalog_digest=digest)))


if __name__ == "__main__":
    main()
