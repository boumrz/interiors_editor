"""Package Gradle installDist and verify a read-only catalog service upgrade."""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tarfile
import tempfile
import zipfile


APP = "interiors-catalog-control-plane"
LAUNCHER = f"bin/{APP}"
MAIN_CLASS = "dev/interiors/catalog/CatalogControlPlaneKt.class"
MANIFEST = "catalog-inventory.json"
MIGRATION = "db/migration/V1__catalog_schema.sql"
SEED = {"catalog/catalog-envelope-source.json", "catalog/catalog-resource-files-v1.json"}
MAX_FILES = 512
MAX_FILE = 100 * 1024 * 1024
MAX_TOTAL = 300 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def allowed(name):
    return isinstance(name, str) and (name in {LAUNCHER, LAUNCHER + ".bat"} or
        re.fullmatch(r"lib/[A-Za-z0-9][A-Za-z0-9._+-]{0,200}\.jar", name) is not None)


def validate_manifest(manifest, commit):
    require(isinstance(commit, str) and re.fullmatch(r"[a-f0-9]{40}", commit), "Invalid catalog commit")
    require(isinstance(manifest, dict) and set(manifest) == {"version", "commit", "files"} and
            type(manifest["version"]) is int and manifest["version"] == 1 and manifest["commit"] == commit,
            "Catalog manifest schema or commit mismatch")
    files = manifest["files"]
    require(isinstance(files, dict) and 2 <= len(files) <= MAX_FILES and LAUNCHER in files,
            "Missing catalog distribution or launcher")
    size = 0
    for name, row in files.items():
        require(allowed(name) and isinstance(row, dict) and set(row) == {"size", "sha256"},
                "Invalid catalog member")
        require(type(row["size"]) is int and 0 < row["size"] <= MAX_FILE and
                isinstance(row["sha256"], str) and re.fullmatch(r"[a-f0-9]{64}", row["sha256"]),
                "Invalid catalog file descriptor")
        size += row["size"]
    require(size <= MAX_TOTAL, "Catalog distribution exceeds size limit")


def distribution_files(directory):
    directory = Path(directory)
    require(directory.is_dir() and not directory.is_symlink(), "Expected regular catalog distribution directory")
    require({p.name for p in directory.iterdir()} == {"bin", "lib"}, "Unexpected catalog distribution contents")
    files = {}
    total = 0
    for part in ("bin", "lib"):
        parent = directory / part
        require(parent.is_dir() and not parent.is_symlink(), "Invalid catalog distribution subdirectory")
        for path in sorted(parent.iterdir()):
            name = part + "/" + path.name
            require(allowed(name) and not path.is_symlink() and path.is_file(), "Unexpected catalog file: " + name)
            size = path.stat().st_size
            total += size
            require(0 < size <= MAX_FILE and total <= MAX_TOTAL and len(files) < MAX_FILES,
                    "Catalog distribution exceeds limits")
            files[name] = path
    require(LAUNCHER in files, "Catalog launcher missing")
    return files


def data_contract(directory):
    # Flyway searches the entire runtime classpath, including dependencies.
    files = distribution_files(directory)
    main_jars = [name for name in files if re.fullmatch(r"lib/" + APP + r"(?:-[^/]+)?\.jar", name)]
    require(len(main_jars) == 1, "Expected exactly one catalog application JAR")
    resources = {}
    has_main = False
    size = 0
    for name, path in files.items():
        if not name.startswith("lib/"):
            continue
        try:
            with zipfile.ZipFile(path) as jar:
                for member in jar.infolist():
                    key = member.filename
                    if name == main_jars[0] and key == MAIN_CLASS:
                        has_main = True
                    if member.is_dir() or not (
                        key.startswith("db/migration/") or key in SEED or
                        (key.startswith("catalog/evidence-assets/") and key.endswith((".glb", ".png")))
                    ):
                        continue
                    size += member.file_size
                    require(key not in resources and 0 < member.file_size <= MAX_FILE and size <= MAX_TOTAL,
                            "Duplicate or oversized catalog migration or seed resource")
                    resources[key] = hashlib.sha256(jar.read(member)).hexdigest()
        except zipfile.BadZipFile as error:
            raise ValueError("Invalid catalog runtime JAR: " + name) from error
    require(has_main and {MIGRATION, *SEED} <= resources.keys(), "Incomplete catalog application or data contract")
    return resources


def verify_catalog_schema(current_dist, candidate_dist):
    """Refuse upgrades requiring writes to the active database or a new seed publication."""
    current = data_contract(current_dist)
    candidate = data_contract(candidate_dist)
    require(current == candidate, "Catalog migrations or published seed inputs differ from the installed distribution")
    return candidate


def package_catalog(distribution, output, commit):
    data_contract(distribution)
    files = distribution_files(distribution)
    manifest = {"version": 1, "commit": commit, "files": {
        name: {"size": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        for name, path in files.items()
    }}
    validate_manifest(manifest, commit)
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output.parent, delete=False) as temporary:
        staging = Path(temporary.name)
    try:
        with staging.open("wb") as raw, gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w|", format=tarfile.USTAR_FORMAT) as archive:
                for name in [MANIFEST, *files]:
                    if name == MANIFEST:
                        data = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
                    else:
                        data = files[name].read_bytes()
                        require(hashlib.sha256(data).hexdigest() == manifest["files"][name]["sha256"],
                                "Catalog distribution changed during packaging")
                    entry = tarfile.TarInfo(name)
                    entry.size = len(data)
                    entry.mode = 0o755 if name == LAUNCHER else 0o644
                    archive.addfile(entry, io.BytesIO(data))
        os.replace(staging, output)
    finally:
        staging.unlink(missing_ok=True)
    return manifest


def extract_catalog(archive, destination, expected_commit):
    destination = Path(destination)
    require(not os.path.lexists(destination), "Catalog installation path already exists")
    # A private, new sibling directory prevents a failed extraction becoming an installation.
    with tempfile.TemporaryDirectory(dir=destination.parent) as temporary:
        root = Path(temporary) / "distribution"
        root.mkdir()
        for folder in (root, root / "bin", root / "lib"):
            folder.mkdir(exist_ok=True)
            folder.chmod(0o755)
        with tarfile.open(archive, "r|gz") as package:
            entries = iter(package)
            first = next(entries, None)
            require(first and first.name == MANIFEST and first.type == tarfile.REGTYPE and
                    0 < first.size < 256 * 1024, "Catalog inventory missing or oversized")
            manifest = json.load(package.extractfile(first))
            validate_manifest(manifest, expected_commit)
            missing = set(manifest["files"])
            for member in entries:
                name = member.name
                require(member.type == tarfile.REGTYPE and name in missing, "Unexpected, linked or duplicate catalog file")
                row = manifest["files"][name]
                require(member.size == row["size"], "Catalog file size mismatch")
                data = package.extractfile(member).read()
                require(hashlib.sha256(data).hexdigest() == row["sha256"], "Catalog file digest mismatch")
                file = root / name
                file.write_bytes(data)
                file.chmod(0o755 if name == LAUNCHER else 0o644)
                missing.remove(name)
            require(not missing, "Catalog archive is incomplete")
        data_contract(root)
        root.rename(destination)
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--distribution", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    package_catalog(args.distribution, args.output, args.commit)
