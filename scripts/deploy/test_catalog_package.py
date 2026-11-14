import hashlib
import io
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
import zipfile

from catalog_package import extract_catalog, package_catalog, verify_catalog_schema


COMMIT = "8" * 40
PRIMARY = "interiors-catalog-control-plane-0.1.jar"
LAUNCHER = "bin/interiors-catalog-control-plane"
SCHEMA = "db/migration/V1__catalog_schema.sql"
SEED = "catalog/catalog-envelope-source.json"
MAPPING = "catalog/catalog-resource-files-v1.json"


def jar(path, entries):
    with zipfile.ZipFile(path, "w") as output:
        for name, value in entries.items():
            output.writestr(name, value)


def distribution(path, *, extra=None, schema=b"CREATE TABLE x", seed=b"{}"):
    (path / "bin").mkdir(parents=True)
    (path / "lib").mkdir()
    (path / LAUNCHER).write_bytes(b"#!/bin/sh\n")
    entries = {
        "dev/interiors/catalog/CatalogControlPlaneKt.class": b"bytecode",
        SCHEMA: schema, SEED: seed, MAPPING: b"{}",
    }
    entries.update(extra or {})
    jar(path / "lib" / PRIMARY, entries)
    jar(path / "lib" / "dependency.jar", {"example/Type.class": b"bytecode"})
    return path


class CatalogPackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.dist = distribution(self.root / "build")
        self.archive = self.root / "catalog.tar.gz"
        self.dest = self.root / "unpacked"

    def test_round_trip_reproducible_and_executable(self):
        manifest = package_catalog(self.dist, self.archive, COMMIT)
        initial = hashlib.sha256(self.archive.read_bytes()).digest()
        second = self.root / "another.tar.gz"
        package_catalog(self.dist, second, COMMIT)
        self.assertEqual(initial, hashlib.sha256(second.read_bytes()).digest())
        previous_mask = os.umask(0o077)
        try:
            self.assertEqual(manifest, extract_catalog(self.archive, self.dest, COMMIT))
        finally:
            os.umask(previous_mask)
        self.assertEqual({p.relative_to(self.dest) for p in self.dest.rglob("*")},
                         {p.relative_to(self.dist) for p in self.dist.rglob("*")})
        self.assertEqual((self.dest / LAUNCHER).read_bytes(), (self.dist / LAUNCHER).read_bytes())
        self.assertEqual((self.dest / LAUNCHER).stat().st_mode & 0o777, 0o755)
        self.assertEqual((self.dest / "lib" / PRIMARY).stat().st_mode & 0o777, 0o644)
        for directory in (self.dest, self.dest / "bin", self.dest / "lib"):
            self.assertEqual(directory.stat().st_mode & 0o777, 0o755)

    def test_rejects_link_and_unexpected_build_outputs(self):
        extra = self.dist / "lib" / "linked.jar"
        extra.symlink_to(self.dist / "lib" / PRIMARY)
        with self.assertRaises(ValueError):
            package_catalog(self.dist, self.archive, COMMIT)
        extra.unlink()
        (self.dist / "private.env").write_text("synthetic")
        with self.assertRaises(ValueError):
            package_catalog(self.dist, self.archive, COMMIT)

    def test_rejects_wrong_commit_without_leaving_an_installation(self):
        package_catalog(self.dist, self.archive, COMMIT)
        with self.assertRaises(ValueError):
            extract_catalog(self.archive, self.dest, "9" * 40)
        self.assertFalse(self.dest.exists())

    def test_rejects_corrupt_member_unexpected_entry_link_duplicate_and_traversal(self):
        package_catalog(self.dist, self.archive, COMMIT)
        with tarfile.open(self.archive) as original:
            originals = [(entry, original.extractfile(entry).read()) for entry in original]
        for change in ("changed", "extra", "link", "duplicate", "traversal", "missing"):
            with self.subTest(change=change):
                entries = list(originals)
                if change == "changed":
                    entry, data = entries[-1]
                    entries[-1] = (entry, b"x" * len(data))
                elif change == "missing":
                    entries.pop()
                else:
                    name = {"extra": "lib/extra.jar", "link": "lib/linked.jar",
                            "duplicate": LAUNCHER, "traversal": "../unsafe"}[change]
                    member = tarfile.TarInfo(name)
                    if change == "link":
                        member.type, member.linkname = tarfile.SYMTYPE, "../unsafe"
                    entries.append((member, b""))
                with tarfile.open(self.archive, "w:gz") as new:
                    for entry, data in entries:
                        new.addfile(entry, io.BytesIO(data))
                with self.assertRaises(ValueError):
                    extract_catalog(self.archive, self.dest, COMMIT)
                self.assertFalse(self.dest.exists())
                self.assertFalse((self.root / "unsafe").exists())

    def test_code_only_change_is_deployable(self):
        candidate = distribution(self.root / "next", extra={"dev/interiors/catalog/New.class": b"feature"})
        verify_catalog_schema(self.dist, candidate)

    def test_schema_and_seed_changes_require_their_own_publication(self):
        cases = [
            {"schema": b"ALTER TABLE x"}, {"seed": b'{"new":true}'},
            {"extra": {"db/migration/V2__next.sql": b"ALTER TABLE x"}},
            {"extra": {"catalog/evidence-assets/model.glb": b"new"}},
        ]
        for index, kwargs in enumerate(cases):
            with self.subTest(kwargs=kwargs):
                candidate = distribution(self.root / str(index), **kwargs)
                with self.assertRaises(ValueError):
                    verify_catalog_schema(self.dist, candidate)

    def test_validates_migrations_from_dependency_jars(self):
        candidate = distribution(self.root / "next")
        jar(candidate / "lib" / "dependency.jar", {"db/migration/V2__hidden.sql": b"change"})
        with self.assertRaises(ValueError):
            verify_catalog_schema(self.dist, candidate)


if __name__ == "__main__":
    unittest.main()
