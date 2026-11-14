#!/usr/bin/env python3
"""Refuse frontend publication when the locally reviewed catalog inputs change.

This snapshot does not assert equivalence with the live server. Backend rollout
requires service inspection, database compatibility checks and its own review.
The CLI verifies only; it never creates or refreshes its baseline.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import sys


CLASSIFICATION = "LOCAL_PREPARED_DEPLOYMENT_BOUNDARY"
ROOT = Path(__file__).resolve().parents[2]
BASELINE = Path(__file__).with_name("catalog-source-baseline.json")
SCOPES = ("apps/catalog-control-plane", "contracts/catalog-control-plane")
GENERATED = {"build", ".gradle", ".kotlin", "node_modules", "__pycache__", ".git", ".idea"}
REQUIRED_INPUTS = {"apps/catalog-control-plane/build.gradle.kts", "contracts/catalog-control-plane/catalog-schema-v1.sql"}


def ignored(relative):
    parts = relative.parts
    return (
        any(part in GENERATED for part in parts)
        or parts[:2] == ("src", "test")
        or parts[0] == "fixtures"
        or relative.name.upper().startswith("README")
        or relative.name == ".DS_Store"
        or relative.suffix in {".pyc", ".pyo"}
    )


def catalog_snapshot(root):
    root = Path(root)
    files = {}
    for scope in SCOPES:
        directory = root / scope
        if not directory.is_dir() or directory.is_symlink():
            raise ValueError("Catalog input directory is missing or linked: " + scope)
        for current, directories, names in os.walk(directory, followlinks=False):
            current = Path(current)
            for name in list(directories):
                path = current / name
                if ignored(path.relative_to(directory)):
                    directories.remove(name)
                elif path.is_symlink():
                    raise ValueError("Linked catalog input is not accepted: " + path.relative_to(root).as_posix())
            for name in names:
                path = current / name
                if ignored(path.relative_to(directory)):
                    continue
                if path.is_symlink() or not path.is_file():
                    raise ValueError("Nonregular catalog input: " + path.relative_to(root).as_posix())
                digest = hashlib.sha256()
                size = 0
                with path.open("rb") as stream:
                    for block in iter(lambda: stream.read(1024 * 1024), b""):
                        size += len(block)
                        digest.update(block)
                files[path.relative_to(root).as_posix()] = {"byteLength": size, "sha256": digest.hexdigest()}
    if not REQUIRED_INPUTS <= set(files):
        raise ValueError("Required catalog build or database contract input is missing")
    return {
        "schemaVersion": 1,
        "classification": CLASSIFICATION,
        "serverEquivalenceVerified": False,
        "updatePolicy": "Separate inspected backend rollout and explicit review; no automatic baseline refresh.",
        "files": dict(sorted(files.items())),
    }


def verify_boundary(root=ROOT, baseline=BASELINE):
    try:
        expected = json.loads(Path(baseline).read_text())
    except (OSError, ValueError) as error:
        raise ValueError("Catalog deployment boundary baseline is missing or unreadable; it was not regenerated") from error
    if (
        not isinstance(expected, dict)
        or expected.get("schemaVersion") != 1
        or expected.get("classification") != CLASSIFICATION
        or expected.get("serverEquivalenceVerified") is not False
        or not isinstance(expected.get("files"), dict)
        or not REQUIRED_INPUTS <= set(expected["files"])
    ):
        raise ValueError("Catalog deployment boundary baseline is invalid; separate backend review is required")
    for path, descriptor in expected["files"].items():
        if (
            not isinstance(path, str)
            or not isinstance(descriptor, dict)
            or set(descriptor) != {"byteLength", "sha256"}
            or type(descriptor["byteLength"]) is not int
            or descriptor["byteLength"] < 0
            or not isinstance(descriptor["sha256"], str)
            or re.fullmatch(r"[0-9a-f]{64}", descriptor["sha256"]) is None
        ):
            raise ValueError("Catalog deployment boundary baseline contains an invalid input descriptor")
    actual = catalog_snapshot(root)["files"]
    before, after = set(expected["files"]), set(actual)
    return {
        "added": sorted(after - before),
        "deleted": sorted(before - after),
        "changed": sorted(path for path in before & after if expected["files"][path] != actual[path]),
    }


def main():
    if len(sys.argv) != 1:
        raise ValueError("Usage: python3 scripts/deploy/catalog_boundary.py; baseline acceptance is never automatic")
    changes = verify_boundary()
    if any(changes.values()):
        print("Frontend publication refused: catalog production, build or contract inputs changed.", file=sys.stderr)
        print("Inspect and implement the backend rollout before explicitly reviewing a new boundary baseline.", file=sys.stderr)
        for kind, paths in changes.items():
            for path in paths:
                print(kind + ": " + path, file=sys.stderr)
        return 1
    print("Catalog inputs match the local deployment boundary; live server equivalence remains unverified.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
