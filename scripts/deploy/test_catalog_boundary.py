"""The frontend pipeline must refuse unreviewed catalog source changes."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


MODULE = Path(__file__).with_name("catalog_boundary.py")
spec = importlib.util.spec_from_file_location("catalog_boundary", MODULE)
boundary = importlib.util.module_from_spec(spec)
if MODULE.exists():
    spec.loader.exec_module(boundary)


class CatalogBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / "apps/catalog-control-plane/src/main/kotlin/Catalog.kt"
        self.source.parent.mkdir(parents=True)
        self.source.write_text("class Catalog")
        (self.root / "apps/catalog-control-plane/build.gradle.kts").write_text("plugins {}")
        self.contract = self.root / "contracts/catalog-control-plane/catalog-schema-v1.sql"
        self.contract.parent.mkdir(parents=True)
        self.contract.write_text("CREATE TABLE catalog(id INTEGER);")
        self.baseline = self.root / "baseline.json"

    def freeze(self):
        self.baseline.write_text(json.dumps(boundary.catalog_snapshot(self.root)))

    def test_unchanged_snapshot_is_only_a_local_boundary(self):
        self.freeze()
        snapshot = json.loads(self.baseline.read_text())
        self.assertEqual(snapshot["classification"], "LOCAL_PREPARED_DEPLOYMENT_BOUNDARY")
        self.assertIs(snapshot["serverEquivalenceVerified"], False)
        self.assertEqual(boundary.verify_boundary(self.root, self.baseline), {"added": [], "deleted": [], "changed": []})

    def test_same_length_content_drift_requires_review(self):
        self.freeze()
        frozen = self.baseline.read_bytes()
        self.source.write_text("class Changed")
        result = boundary.verify_boundary(self.root, self.baseline)
        self.assertEqual(result["changed"], [self.source.relative_to(self.root).as_posix()])
        self.assertEqual(self.baseline.read_bytes(), frozen)

    def test_added_and_deleted_production_inputs_are_not_accepted(self):
        self.freeze()
        added = self.source.with_name("Added.kt")
        added.write_text("class Added")
        self.source.unlink()
        result = boundary.verify_boundary(self.root, self.baseline)
        self.assertEqual(result["added"], [added.relative_to(self.root).as_posix()])
        self.assertEqual(result["deleted"], [self.source.relative_to(self.root).as_posix()])

    def test_contract_and_build_configuration_changes_are_guarded(self):
        self.freeze()
        self.contract.write_text("CREATE TABLE changed(id INTEGER);")
        config = self.root / "apps/catalog-control-plane/build.gradle.kts"
        config.write_text("plugins { changed }")
        self.assertEqual(len(boundary.verify_boundary(self.root, self.baseline)["changed"]), 2)

    def test_tests_readme_and_generated_outputs_do_not_block_frontend(self):
        self.freeze()
        for relative in ["apps/catalog-control-plane/src/test/Test.kt", "apps/catalog-control-plane/build/distribution.zip", "apps/catalog-control-plane/.gradle/cache.bin", "apps/catalog-control-plane/README.md", "contracts/catalog-control-plane/fixtures/test.json"]:
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("disposable test or documentation")
        self.assertEqual(boundary.verify_boundary(self.root, self.baseline), {"added": [], "deleted": [], "changed": []})

    def test_missing_and_empty_baselines_fail_without_being_written(self):
        with self.assertRaises(ValueError):
            boundary.verify_boundary(self.root, self.baseline)
        self.assertFalse(self.baseline.exists())
        self.freeze()
        snapshot = json.loads(self.baseline.read_text())
        snapshot["files"] = {}
        self.baseline.write_text(json.dumps(snapshot))
        with self.assertRaises(ValueError):
            boundary.verify_boundary(self.root, self.baseline)
        self.assertEqual(json.loads(self.baseline.read_text())["files"], {})

    def test_source_symlinks_cannot_escape_the_catalog_boundary(self):
        self.freeze()
        self.source.with_name("linked.kt").symlink_to(self.contract)
        with self.assertRaises(ValueError):
            boundary.verify_boundary(self.root, self.baseline)

    def test_cli_has_no_automatic_acceptance_switch(self):
        with patch.object(boundary.sys, "argv", ["catalog_boundary.py", "--accept"]):
            with self.assertRaisesRegex(ValueError, "never automatic"):
                boundary.main()


if __name__ == "__main__":
    unittest.main()
