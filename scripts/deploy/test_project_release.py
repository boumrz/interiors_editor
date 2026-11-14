import contextlib
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import project_release


class ProjectReleaseTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.archive = self.directory / "project.tar"
        self.commit = "a" * 40

    def write_bundle(self, entries):
        with tarfile.open(self.archive, "w") as archive:
            for name, data in entries:
                item = tarfile.TarInfo(name)
                if data is None:
                    item.type = tarfile.SYMTYPE
                    item.linkname = "catalog.tar.gz"
                    archive.addfile(item)
                else:
                    item.size = len(data)
                    archive.addfile(item, io.BytesIO(data))

    def test_refuses_missing_duplicate_unknown_and_linked_components(self):
        frontend = ("frontend.tar.gz", b"f")
        catalog = ("catalog.tar.gz", b"c")
        for entries in ([frontend], [frontend, catalog, catalog], [frontend, catalog, ("README", b"")],
                        [frontend, ("catalog.tar.gz", None)]):
            with self.subTest(entries=entries), tempfile.TemporaryDirectory() as output:
                self.write_bundle(entries)
                with self.assertRaises(ValueError):
                    project_release.unpack_components(self.archive, Path(output))

    def test_catalog_rolls_back_if_frontend_activation_fails(self):
        self.write_bundle([("frontend.tar.gz", b"frontend"), ("catalog.tar.gz", b"catalog")])
        events = []

        @contextlib.contextmanager
        def catalog(archive, commit):
            self.assertEqual((archive.read_bytes(), commit), (b"catalog", self.commit))
            events.append("catalog")
            try:
                yield {"changed": True}
            except RuntimeError:
                events.append("catalog rollback")
                raise

        def frontend(archive, root, site, *, expected_commit, catalog_receipt):
            self.assertEqual(archive.read_bytes(), b"frontend")
            self.assertEqual(expected_commit, self.commit)
            self.assertEqual(catalog_receipt, {"changed": True})
            events.append("frontend")
            raise RuntimeError("synthetic health failure")

        with patch.object(project_release, "active_catalog", catalog), patch.object(project_release, "activate_release", frontend):
            with self.assertRaisesRegex(RuntimeError, "synthetic health failure"):
                project_release.activate_project(self.archive, self.commit, self.directory, self.directory / "site")
        self.assertEqual(events, ["catalog", "frontend", "catalog rollback"])


if __name__ == "__main__":
    unittest.main()
