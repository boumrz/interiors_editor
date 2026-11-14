#!/usr/bin/env python3
"""Exact, retained, rollback-safe frontend deployment. Python standard library only."""
import argparse
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import signal
import tarfile
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

CONTROLS = {"/index.html", "/release-manifest.json", "/release-set.json", "/sw.js", "/manifest.webmanifest"}
ORIGINS = {"web": "https://www.domiknote.ru", "telegram": "https://domiknote.ru"}
MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES = 4096, 128 * 1024 * 1024, 1024 * 1024 * 1024


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
        require(expected == [row for row in rows if row["path"] != "/release-set.json"], "Telegram sealed inventory mismatch")
    return build


def package_release(web, telegram, output, commit):
    require(re.fullmatch(r"[a-f0-9]{40}", commit), "Expected full Git commit SHA")
    directories = {"web": Path(web), "telegram": Path(telegram)}
    rows = {target: file_rows(directory) for target, directory in directories.items()}
    builds = {target: validate_target(directory, target, rows[target]) for target, directory in directories.items()}
    inventory = {"schemaVersion": 1, "commit": commit, "release": builds["web"] + "--" + builds["telegram"], "targets": rows}
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
    """Inspect every header before writing anything; never use extractall()."""
    destination = Path(destination)
    require(not destination.exists(), "Extraction target already exists")
    with tarfile.open(archive_path, "r:gz") as archive:
        members = {}
        total = 0
        for member in archive:
            safe_path(member.name)
            require(member.isfile() and member.name not in members, "Archive contains link, special file or duplicate")
            require(member.name == "inventory.json" or member.name.split("/", 1)[0] in ("web", "telegram"), "Unknown archive target")
            total += member.size
            require(0 <= member.size <= MAX_FILE_BYTES and total <= MAX_TOTAL_BYTES and len(members) < MAX_FILES, "Archive exceeds deployment limits")
            members[member.name] = member
        require("inventory.json" in members and members["inventory.json"].size <= 4 * 1024 * 1024, "Missing or excessive inventory")
        inventory = json.loads(archive.extractfile(members["inventory.json"]).read())
        require(set(inventory) == {"schemaVersion", "commit", "release", "targets"} and inventory["schemaVersion"] == 1, "Unknown inventory schema")
        require(isinstance(inventory["commit"], str) and re.fullmatch(r"[a-f0-9]{40}", inventory["commit"]), "Invalid source commit")
        require(set(inventory["targets"]) == {"web", "telegram"}, "Missing separate build targets")
        expected = {"inventory.json"}
        for target, rows in inventory["targets"].items():
            require(isinstance(rows, list) and rows, "Empty inventory target")
            for row in rows:
                require(set(row) == {"path", "byteLength", "sha256"} and isinstance(row["path"], str) and row["path"].startswith("/"), "Invalid descriptor")
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
    builds = {target: validate_target(destination / target, target, rows) for target, rows in inventory["targets"].items()}
    require(inventory["release"] == builds["web"] + "--" + builds["telegram"], "Release identity mismatch")
    return inventory


def nginx_site(root, paths):
    """Preserve the accepted HTTPS, ACME, read-only catalog and exact-path policy."""
    root = str(root)
    require(re.fullmatch(r"/[A-Za-z0-9_./-]+", root), "Unsafe frontend root")
    lines = ["server {", "    listen 80;", "    listen [::]:80;", "    server_name domiknote.ru www.domiknote.ru;", "    location ^~ /.well-known/acme-challenge/ {", "        root /var/lib/letsencrypt;", "        default_type text/plain;", "        try_files $uri =404;", "    }", "    location / { return 301 https://$host$request_uri; }", "}"]
    for target, origin in ORIGINS.items():
        lines.extend(["server {", "    listen 443 ssl;", "    listen [::]:443 ssl;", "    ssl_certificate /etc/letsencrypt/live/interiors-domiknote/fullchain.pem;", "    ssl_certificate_key /etc/letsencrypt/live/interiors-domiknote/privkey.pem;", "    ssl_protocols TLSv1.2 TLSv1.3;", "    server_name " + origin.split("//")[1] + ";", "    access_log off;", "    error_log /dev/null crit;", "    if ($request_method !~ ^(GET|HEAD)$) { return 405; }", "    if ($invalid_frontend_path) { return 404; }", "    add_header X-Content-Type-Options nosniff always;", "    add_header Referrer-Policy no-referrer always;", "    add_header Cache-Control no-store always;", "    include /etc/nginx/snippets/interiors-catalog-readonly.conf;"])
        for path in ["/"] + sorted(paths[target]):
            if path != "/":
                safe_path(path[1:])
            control = path == "/" or path in CONTROLS
            location_root = root + ("/current/" if control else "/retained/") + target
            cache = "no-store" if control else "public, max-age=31536000, immutable"
            lines.extend(["    location = " + path + " {", "        root " + location_root + ";", "        try_files " + ("/index.html" if path == "/" else path) + " =404;", "        etag " + ("off" if control else "on") + ";", "        if_modified_since " + ("off" if control else "exact") + ";", "        add_header X-Content-Type-Options nosniff always;", "        add_header Referrer-Policy no-referrer always;", '        add_header Cache-Control "' + cache + '" always;', "    }"])
        lines.extend(["    location / { return 404; }", "}"])
    return ("\n".join(lines) + "\n").encode()


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


def activate_release(archive, root, site, command=run_command, health=None, expected_commit=None, ready=None,
                     catalog_receipt=None):
    root, site = Path(root).absolute(), Path(site).absolute()
    require(root.is_dir() and not root.is_symlink(), "Existing frontend root required")
    require(site.is_file() and not site.is_symlink(), "Expected existing Nginx site file")
    require((root / "current").is_symlink(), "Expected existing atomic current pointer")
    with open(root / ".deploy.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        previous = (root / "current").readlink()
        require(not previous.is_absolute() and previous.parts[0] == "releases" and len(previous.parts) == 2 and ".." not in previous.parts, "Unsafe current pointer")
        with tempfile.TemporaryDirectory(prefix=".staging-", dir=root) as work:
            staging = Path(work) / "release"
            inventory = extract_release(archive, staging)
            require(expected_commit is None or inventory["commit"] == expected_commit, "Archive source commit mismatch")
            retained = root / "retained"
            require(not retained.is_symlink(), "Linked retained pool")
            paths = {}
            # Check every collision before adding any new file or changing controls.
            for target, rows in inventory["targets"].items():
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
            release = root / "releases" / inventory["release"]
            public_directory(release.parent)
            require(not release.parent.is_symlink() and not release.is_symlink(), "Linked release storage")
            if release.exists():
                for target, rows in inventory["targets"].items():
                    require(file_rows(release / target) == rows, "Existing release identity has different files")
            else:
                os.replace(staging, release)
            for target, rows in inventory["targets"].items():
                for row in rows:
                    if row["path"] in CONTROLS:
                        continue
                    path = retained / target / row["path"][1:]
                    public_directory(path.parent)
                    if not path.exists():
                        atomic_bytes(path, (release / target / row["path"][1:]).read_bytes())
            old_config = site.read_bytes()
            new_config = nginx_site(root, paths)
            config_changed = False
            switched = False
            try:
                atomic_bytes(site, new_config)
                config_changed = True
                command(["nginx", "-t"])
                # New allowlisted immutable URLs are live before the new shell.
                command(["systemctl", "reload", "nginx"])
                (ready or wait_for_assets)(inventory)
                atomic_link(root / "current", "releases/" + inventory["release"])
                switched = True
                if health is not None:
                    health(inventory)
                else:
                    smoke_release(inventory, expected_catalog_digest=(
                        catalog_receipt["publicationSha256"] if catalog_receipt is not None else None))
                receipt = {"deployed": True, "commit": inventory["commit"], "release": inventory["release"], "previous": str(previous), "backendChanged": False, "retainedAssetsDeleted": False}
                if catalog_receipt is not None:
                    receipt.update(catalog=catalog_receipt, backendChanged=catalog_receipt["changed"])
                atomic_bytes(root / "last-deployment.json", json_bytes(receipt))
            except BaseException:
                if switched:
                    atomic_link(root / "current", previous)
                if config_changed:
                    # A shell may already be loaded. Keep its new immutable URLs
                    # alongside the old ones after reverting the active controls.
                    atomic_bytes(site, new_config if switched else old_config)
                    command(["nginx", "-t"])
                    command(["systemctl", "reload", "nginx"])
                raise
            return receipt


def request(origin, path, method="GET", headers=None, timeout=15):
    deadline = time.monotonic() + timeout
    try:
        response = urlopen(Request(origin + path, method=method, headers=headers or {}), timeout=timeout)
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


def smoke_release(inventory, timeout_seconds=180, expected_catalog_digest=None):
    deadline = time.monotonic() + timeout_seconds
    def probe(origin, path, method="GET", headers=None):
        remaining = deadline - time.monotonic()
        require(remaining > 0, "Public health-check deadline exceeded")
        return request(origin, path, method, headers, timeout=min(15, remaining))
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    package = commands.add_parser("package")
    for option in ("web", "telegram", "output", "commit"):
        package.add_argument("--" + option, required=True)
    activate = commands.add_parser("activate")
    activate.add_argument("--archive", required=True)
    activate.add_argument("--commit", required=True)
    activate.add_argument("--root", default="/opt/interiors-editor/frontend")
    activate.add_argument("--site", default="/etc/nginx/sites-available/interiors-editor.conf")
    smoke = commands.add_parser("smoke")
    smoke.add_argument("--archive", required=True)
    smoke.add_argument("--receipt", type=Path)
    arguments = parser.parse_args()
    if arguments.command == "package":
        result = package_release(arguments.web, arguments.telegram, arguments.output, arguments.commit)
        print(json.dumps({"packaged": True, "commit": result["commit"], "release": result["release"]}))
    elif arguments.command == "activate":
        require(os.geteuid() == 0, "Activation requires the pre-provisioned privileged deployment service")
        require(re.fullmatch(r"[a-f0-9]{40}", arguments.commit), "Expected full source commit SHA")
        def interrupted(signum, _frame):
            raise InterruptedError("Deployment interrupted by signal " + str(signum))
        signal.signal(signal.SIGTERM, interrupted)
        signal.signal(signal.SIGINT, interrupted)
        print(json.dumps(activate_release(arguments.archive, arguments.root, arguments.site, expected_commit=arguments.commit)))
    else:
        with tempfile.TemporaryDirectory(prefix="interiors-deploy-smoke-") as temporary:
            result = extract_release(arguments.archive, Path(temporary) / "release")
            digest = receipt_catalog_digest(result, json.loads(arguments.receipt.read_bytes())) if arguments.receipt else None
            print(json.dumps(smoke_release(result, expected_catalog_digest=digest)))


if __name__ == "__main__":
    main()
