"""Switch the existing, unprivileged catalog service without altering its database."""
import contextlib
import hashlib
import http.client
import json
import os
from pathlib import Path
import pwd
import re
import subprocess
import tempfile
import time

import catalog_package
from frontend import atomic_bytes

UNIT = "interiors-catalog.service"
RELEASES = Path("/opt/interiors-editor/catalog-releases")
DROPIN = Path("/etc/systemd/system/interiors-catalog.service.d/90-interiors-deployment.conf")
LAUNCHER = Path("bin/interiors-catalog-control-plane")
RUNTIME_ENV = "/etc/interiors-editor/catalog/runtime.env"


def check(condition, message):
    if not condition:
        raise ValueError(message)


def service_distribution(properties):
    required = {"User": "interiors-catalog", "Group": "interiors-catalog",
                "ActiveState": "active", "NoNewPrivileges": "yes", "ProtectSystem": "strict",
                "FragmentPath": "/etc/systemd/system/" + UNIT,
                "EnvironmentFiles": RUNTIME_ENV + " (ignore_errors=no)"}
    for key, expected in required.items():
        check(properties.get(key) == expected, "Unexpected catalog unit property: " + key)
    check(re.fullmatch(r"[1-9][0-9]*", properties.get("MainPID", "")), "Catalog process is not running")
    command = re.fullmatch(r"\{ path=([/A-Za-z0-9_.-]+) ; argv\[\]=\1 serve ; ignore_errors=no ; [^{}]*\}",
                           properties.get("ExecStart", ""))
    check(command, "Unrecognized catalog service launcher or arguments")
    launcher = Path(command[1])
    distribution = launcher.parent.parent
    check(launcher == distribution / LAUNCHER and distribution.name == "catalog-control-plane"
          and distribution.parent.parent == RELEASES
          and re.fullmatch(r"20261106-initial|[a-f0-9]{40}", distribution.parent.name),
          "Catalog launcher is outside its managed releases")
    return distribution


def verify_process_distribution(distribution, arguments):
    """Tie the live JVM to all and only the configured release's runtime JARs."""
    check(arguments and Path(arguments[0]).name == "java" and arguments.count("-classpath") == 1,
          "Unrecognized catalog JVM command")
    position = arguments.index("-classpath")
    check(position >= 1 and len(arguments) == position + 4
          and arguments[position + 2:] == ["dev.interiors.catalog.CatalogControlPlaneKt", "serve"]
          and not any(value in {"-cp", "--class-path", "-jar", "-m", "--module"}
                      for value in arguments[1:position]), "Unexpected catalog JVM launch arguments")
    classpath = arguments[position + 1].split(":")
    expected = {str(path) for name, path in catalog_package.distribution_files(distribution).items()
                if name.startswith("lib/")}
    check(len(classpath) == len(expected) and set(classpath) == expected,
          "Catalog JVM classpath differs from its configured release")


def inspect_unit():
    names = ["User", "Group", "ActiveState", "NoNewPrivileges", "ProtectSystem", "MainPID",
             "FragmentPath", "EnvironmentFiles", "ExecStart"]
    info = subprocess.run(["systemctl", "show", "--property=" + ",".join(names), UNIT],
                          check=True, capture_output=True, text=True, timeout=15)
    properties = dict(line.split("=", 1) for line in info.stdout.splitlines() if "=" in line)
    distribution = service_distribution(properties)
    process = Path("/proc") / properties["MainPID"]
    arguments = (process / "cmdline").read_bytes().split(b"\0")
    check(arguments[-1] == b"", "Incomplete catalog process command")
    verify_process_distribution(distribution, [os.fsdecode(value) for value in arguments[:-1]])
    status = dict(line.split(":", 1) for line in (process / "status").read_text().splitlines() if ":" in line)
    uid = pwd.getpwnam("interiors-catalog").pw_uid
    check(uid != 0 and [int(value) for value in status["Uid"].split()] == [uid] * 4
          and int(status["CapEff"], 16) == 0, "Catalog process privilege boundary mismatch")
    # Read only names into the check; never copy credentials to an argument or log.
    names = {part.partition(b"=")[0] for part in (process / "environ").read_bytes().split(b"\0")}
    check({b"CATALOG_DATABASE_URL", b"CATALOG_DATABASE_USER", b"CATALOG_DATABASE_PASSWORD"} <= names
          and not any(name.startswith((b"CATALOG_MIGRATION_", b"CATALOG_PUBLISH_")) for name in names),
          "Catalog process must use runtime-only database credentials")
    env = Path(RUNTIME_ENV)
    stat = env.stat()
    check(env.is_file() and not env.is_symlink() and stat.st_uid == 0 and stat.st_mode & 0o077 == 0,
          "Unexpected permissions on catalog runtime configuration")
    return distribution


def runtime_files(directory):
    result = {}
    files = catalog_package.distribution_files(directory)
    check(os.access(files[LAUNCHER.as_posix()], os.X_OK), "Catalog launcher is not executable")
    for name, path in files.items():
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        result[name] = {"size": path.stat().st_size, "sha256": digest.hexdigest()}
    return result


def publication_digest():
    connection = http.client.HTTPConnection("127.0.0.1", 4174, timeout=3)
    try:
        connection.request("GET", "/catalog-api/v1/catalogs/current", headers={"Accept": "application/json"})
        response = connection.getresponse()
        check(response.status == 200, "Catalog is not ready")
        data = response.read(8 * 1024 * 1024 + 1)
        check(len(data) <= 8 * 1024 * 1024 and isinstance(json.loads(data).get("catalogVersion"), str),
              "Catalog did not return a valid publication")
        digest = hashlib.sha256(data).hexdigest()
        check(response.getheader("ETag") == '"' + digest + '"', "Catalog publication ETag mismatch")
        return digest
    finally:
        connection.close()


def wait_publication(expected=None):
    deadline = time.monotonic() + 50
    while True:
        try:
            digest = publication_digest()
        except (OSError, ValueError, http.client.HTTPException):
            if time.monotonic() >= deadline:
                raise RuntimeError("Catalog did not return a healthy publication before the deadline") from None
            time.sleep(0.25)
            continue
        check(expected is None or expected == digest, "Published catalog changed during runtime rollout")
        return digest


def restart_catalog():
    subprocess.run(["systemctl", "daemon-reload"], check=True, timeout=30)
    subprocess.run(["systemctl", "restart", UNIT], check=True, timeout=90)


def exec_override(distribution):
    return ("[Service]\nExecStart=\nExecStart=" + str(distribution / LAUNCHER) + " serve\n").encode()


@contextlib.contextmanager
def active_catalog(archive, expected_commit):
    """Caller serializes this entire context with frontend activation and rollback."""
    check(re.fullmatch("[a-f0-9]{40}", expected_commit), "Invalid catalog commit")
    current = inspect_unit()
    check(RELEASES.is_dir() and not any(path.is_symlink() for path in [RELEASES, current.parent, current]),
          "Linked or missing catalog releases root")
    check(not DROPIN.is_symlink() and not DROPIN.parent.is_symlink(), "Linked catalog service override")
    previous = DROPIN.read_bytes() if DROPIN.exists() else None
    check(previous is None or previous == exec_override(current), "Unmanaged existing catalog service override")
    original_digest = wait_publication()
    candidate = RELEASES / expected_commit / "catalog-control-plane"

    with tempfile.TemporaryDirectory(prefix=".incoming-", dir=RELEASES) as temp:
        staged = Path(temp) / "catalog-control-plane"
        manifest = catalog_package.extract_catalog(archive, staged, expected_commit)
        catalog_package.verify_catalog_schema(current, staged)
        incoming = manifest["files"]
        check(not candidate.is_symlink() and not candidate.parent.is_symlink(), "Linked catalog release")
        if candidate.exists():
            check(runtime_files(candidate) == incoming, "Existing catalog commit contains different files")
        if runtime_files(current) == incoming:
            yield {"changed": False, "release": current.parent.name, "publicationSha256": original_digest}
            return
        if not candidate.exists():
            candidate.parent.mkdir(exist_ok=True)
            candidate.parent.chmod(0o755)
            os.replace(staged, candidate)

    DROPIN.parent.mkdir(mode=0o755, exist_ok=True)
    try:
        atomic_bytes(DROPIN, exec_override(candidate))
        restart_catalog()
        wait_publication(original_digest)
        check(inspect_unit() == candidate, "systemd did not start the candidate catalog release")
        yield {"changed": True, "release": expected_commit, "previous": current.parent.name,
               "publicationSha256": original_digest}
    except BaseException:
        if previous is None:
            if DROPIN.exists():
                DROPIN.unlink()
        else:
            atomic_bytes(DROPIN, previous)
        restart_catalog()
        wait_publication(original_digest)
        check(inspect_unit() == current, "Catalog rollback did not restore the former service")
        raise
