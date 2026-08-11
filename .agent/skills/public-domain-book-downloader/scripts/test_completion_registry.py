#!/usr/bin/env python3
from pathlib import Path
import json
import tempfile
import unittest
import completion_registry as registry

class RegistryTests(unittest.TestCase):
    def test_validate_and_check(self):
        rows = [{"id": 1, "slug": "white-fang", "title": "White Fang", "author": "Jack London"}]
        self.assertTrue(registry.validate_catalog(rows)["ok"])
        self.assertTrue(registry.check_catalog(rows, "White Fang", "Jack London")["completed"])
        self.assertFalse(registry.check_catalog(rows, "The Wind in the Willows", "Kenneth Grahame")["completed"])

    def test_load_catalog(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "catalog.json"
            p.write_text(json.dumps([{"id": 1, "title": "A", "author": "B"}]), encoding="utf-8")
            self.assertEqual(len(registry.load_catalog(p)), 1)

if __name__ == "__main__":
    unittest.main()
