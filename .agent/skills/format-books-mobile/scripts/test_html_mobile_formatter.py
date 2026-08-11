#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent
SCRIPT = ROOT / "html_mobile_formatter.py"

spec = importlib.util.spec_from_file_location("html_mobile_formatter", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec.loader
sys.path.insert(0, str(ROOT))
spec.loader.exec_module(module)


class HtmlMobileFormatterTests(unittest.TestCase):
    def run_cli(self, *args, expect=0):
        result = subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], text=True, capture_output=True)
        self.assertEqual(result.returncode, expect, msg=f"stdout={result.stdout}\nstderr={result.stderr}")
        return result

    def write_decisions(self, workspace: Path, chooser):
        for packet_path in sorted((workspace / "packets").glob("*.json")):
            packet = json.loads(packet_path.read_text(encoding="utf-8"))
            units = [u for p in packet["paragraphs"] for u in p["units"]]
            data = {
                "schema_version": 4,
                "packet_id": packet["packet_id"],
                "reviewed": True,
                "decisions": [],
            }
            for unit in units:
                decision = {"unit_id": unit["id"], "reason": "test"}
                decision.update(chooser(unit, packet))
                data["decisions"].append(decision)
            (workspace / "decisions" / packet_path.name).write_text(json.dumps(data), encoding="utf-8")

    def test_candidate_boundaries_handle_common_abbreviations_and_attribution(self):
        cases = [
            ("Mr. Smith went home. He slept.", 2),
            ('"Stop!" he said. Then he left.', 2),
            ('“Njoo!” alisema. Kisha akaondoka.', 2),
            ("It was 3.14 p.m. He stayed.", 2),
        ]
        for text, expected in cases:
            with self.subTest(text=text):
                spans = module.textfmt.sentence_spans(text, "en")
                self.assertEqual(len(spans), expected)
                rebuilt = "".join(text[a:b] for a, b in spans)
                self.assertEqual(module.textfmt.canonical(text), module.textfmt.canonical(rebuilt))

    def test_contextual_abbreviation_can_end_sentence(self):
        text = "We bought apples, pears, etc. He left."
        spans = module.textfmt.sentence_spans(text, "en")
        self.assertEqual([text[a:b].strip() for a, b in spans], ["We bought apples, pears, etc.", "He left."])

    def test_prepare_force_refuses_workspace_containing_source(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            source.write_text('<html><body><p>Text.</p></body></html>', encoding="utf-8")
            result = self.run_cli("prepare", source, "--workspace", root, "--force", expect=2)
            self.assertIn("workspace contains source file", result.stderr)
            self.assertTrue(source.is_file())

    def test_prepare_rejects_working_source_changed_after_acquisition(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "working_source.html"
            original = '<html><body><p>Original.</p></body></html>'
            source.write_text(original, encoding="utf-8")
            provenance = {
                "schema_version": 4, "selected": {
                    "working_source_sha256": module.sha256_bytes(original.encode("utf-8"))
                }
            }
            (root / "source_manifest.json").write_text(json.dumps(provenance), encoding="utf-8")
            source.write_text('<html><body><p>Changed.</p></body></html>', encoding="utf-8")
            result = self.run_cli("prepare", source, "--workspace", root / "work", expect=2)
            self.assertIn("no longer matches acquisition", result.stderr)

    def test_render_rejects_source_assets_changed_after_prepare(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source_dir = root / "source"
            source_dir.mkdir()
            source = source_dir / "working_source.html"
            assets = source_dir / "assets"
            (assets / "images").mkdir(parents=True)
            asset = assets / "images" / "map.svg"
            asset.write_text("<svg></svg>", encoding="utf-8")
            source.write_text('<html><body><main><p>One.</p><img src="assets/images/map.svg"></main></body></html>', encoding="utf-8")
            inventory = module._asset_inventory(assets)
            provenance = {
                "schema_version": 4, "title": "Demo", "author": "Author",
                "selected": {
                    "provider": "local", "assets_dir": str(assets), "asset_files": inventory,
                    "working_source_sha256": module.sha256_bytes(source.read_bytes()),
                },
            }
            (source_dir / "source_manifest.json").write_text(json.dumps(provenance), encoding="utf-8")
            work = root / "work"
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": False})
            asset.write_text("changed", encoding="utf-8")
            result = self.run_cli(
                "render", "--manifest", work / "manifest.json", "--output", root / "mobile.html",
                "--report", root / "qa.json", "--hard-max-chars", "100", expect=2,
            )
            self.assertIn("source asset directory changed", result.stderr)

    def test_direct_html_agent_split_preserves_inline_markup_and_payload(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            work = root / "work"
            output = root / "mobile_book.html"
            report = root / "qa.json"
            source.write_text(
                '<!doctype html><html><head><meta charset="utf-8"><title>T</title></head>'
                '<body><main><h2>Chapter I</h2><p id="p1">First sentence. Second <em>sentence.</em> Third sentence.</p></main></body></html>',
                encoding="utf-8",
            )
            self.run_cli("prepare", source, "--workspace", work)
            packet = json.loads(next((work / "packets").glob("*.json")).read_text(encoding="utf-8"))
            self.assertEqual(len(packet["required_editable_unit_ids"]), 3)
            self.write_decisions(work, lambda u, p: {"break_after": True})
            self.run_cli("render", "--manifest", work / "manifest.json", "--output", output, "--report", report, "--hard-max-chars", "100")
            rendered = output.read_text(encoding="utf-8")
            self.assertRegex(rendered, r'<span class="mobile-soft-break sentence" aria-hidden="true"></span>')
            self.assertIn('Second <em>sentence.</em>', rendered)
            self.assertIn('Third sentence.</p>', rendered)
            self.assertEqual(rendered.count('id="p1"'), 1)
            data = json.loads(report.read_text(encoding="utf-8"))
            self.assertTrue(data["formal_release"])
            self.assertTrue(data["content_integrity"])
            self.assertEqual(data["final_format"], "html")
            self.assertTrue(data["html_checks"]["ok"])
            self.assertEqual(data["inserted_paragraph_boundaries"], 2)


    def test_poetry_semantics_on_ancestor_protect_child_paragraphs(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            work = root / "work"
            source.write_text(
                '<html><body><p>Ordinary prose. Another sentence.</p>'
                '<div class="poetry"><p>First line. Second line.</p></div>'
                '<section epub:type="z3998:verse"><p>Third line. Fourth line.</p></section>'
                '</body></html>', encoding="utf-8"
            )
            self.run_cli("prepare", source, "--workspace", work)
            manifest = json.loads((work / "manifest.json").read_text(encoding="utf-8"))
            protected = [p for p in manifest["paragraphs"] if p["protected"]]
            editable = [p for p in manifest["paragraphs"] if p["units"]]
            self.assertEqual(len(protected), 2)
            self.assertEqual(len(editable), 1)

    def test_source_paragraph_boundary_remains_hard(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            work = root / "work"
            output = root / "mobile.html"
            report = root / "qa.json"
            source.write_text('<html><body><p>One sentence.</p><p>Two sentence.</p></body></html>', encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": False})
            self.run_cli("render", "--manifest", work / "manifest.json", "--output", output, "--report", report, "--hard-max-chars", "100")
            rendered = output.read_text(encoding="utf-8")
            self.assertIn('<p>One sentence.</p><p>Two sentence.</p>', rendered)

    def test_unsafe_inline_boundary_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            work = root / "work"
            source.write_text('<html><body><p><em>First sentence. Second sentence.</em></p></body></html>', encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", work)
            packet = json.loads(next((work / "packets").glob("*.json")).read_text())
            units = [u for p in packet["paragraphs"] for u in p["units"]]
            self.assertFalse(units[0]["break_after_safe"])
            self.write_decisions(work, lambda u, p: {"break_after": True})
            result = self.run_cli(
                "render", "--manifest", work / "manifest.json", "--output", root / "mobile.html", "--report", root / "qa.json",
                "--hard-max-chars", "100", expect=2,
            )
            self.assertIn("unsafe inside active inline markup", result.stderr)

    def test_br_and_preserve_lines_are_not_agent_editable(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            work = root / "work"
            source.write_text(
                '<html><body><p class="preserve-lines">Line one.<br>Line two.</p><p>Normal one. Normal two.</p></body></html>',
                encoding="utf-8",
            )
            self.run_cli("prepare", source, "--workspace", work)
            manifest = json.loads((work / "manifest.json").read_text())
            self.assertEqual(manifest["protected_paragraphs"], 1)
            self.assertEqual(manifest["editable_units"], 2)

    def test_render_rejects_colliding_output_paths(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            work = root / "work"
            source.write_text('<html><body><p>One.</p></body></html>', encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": False})
            same = root / "same.html"
            result = self.run_cli(
                "render", "--manifest", work / "manifest.json",
                "--output", same, "--report", same, expect=2,
            )
            self.assertIn("paths must all be distinct", result.stderr)

    def test_formal_render_requires_all_agent_decisions(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            work = root / "work"
            source.write_text('<html><body><p>One. Two.</p></body></html>', encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", work)
            packet = json.loads(next((work / "packets").glob("*.json")).read_text())
            first = packet["required_editable_unit_ids"][0]
            partial = {"schema_version": 4, "packet_id": packet["packet_id"], "reviewed": True, "decisions": [{"unit_id": first, "break_after": True}]}
            (work / "decisions" / f"{packet['packet_id']}.json").write_text(json.dumps(partial))
            result = self.run_cli("render", "--manifest", work / "manifest.json", "--output", root / "x.html", "--report", root / "q.json", expect=2)
            self.assertIn("editable units without explicit Agent decisions", result.stderr)

    def test_security_scan_rejects_active_html(self):
        unsafe = '<html><body><script>alert(1)</script><p>Text.</p></body></html>'
        checks = module.html_checks(unsafe)
        self.assertFalse(checks["ok"])
        self.assertIn("script", checks["security"]["active_tags"])

    def test_security_scan_rejects_meta_refresh_and_obfuscated_javascript(self):
        source = '<html><head><meta http-equiv="refresh" content="0; url=https://evil.example"></head><body><p><a href="java&#x0a;script:alert(1)">Text.</a></p></body></html>'
        checks = module.html_checks(source)
        self.assertFalse(checks["ok"])
        self.assertTrue(checks["security"]["meta_refresh"])
        self.assertTrue(checks["security"]["javascript_urls"])

    def test_malformed_inline_nesting_is_rejected(self):
        source = '<html><body><p><em><strong>Hello.</em></strong></p></body></html>'
        checks = module.html_checks(source)
        self.assertFalse(checks["ok"])
        self.assertTrue(checks["inline_markup_errors"])

    def test_document_skeleton_check_ignores_html_tokens_inside_comments(self):
        source = '<!doctype html><html><body><!-- example <html><body> text --><p>Text.</p></body></html>'
        checks = module.html_checks(source)
        self.assertTrue(checks["ok"], checks)

    def test_duplicate_ids_detected(self):
        checks = module.html_checks('<html><body><p id="x">A.</p><p id="x">B.</p></body></html>')
        self.assertFalse(checks["ok"])
        self.assertEqual(checks["duplicate_ids"], ["x"])

    def test_decision_cannot_be_submitted_under_wrong_packet(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            work = root / "work"
            # Force two packets with two large source paragraphs.
            source.write_text('<html><body><p>' + ('One sentence. ' * 120) + '</p><p>' + ('Two sentence. ' * 120) + '</p></body></html>', encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", work, "--batch-chars", "1000")
            packets = sorted((work / "packets").glob("*.json"))
            self.assertGreaterEqual(len(packets), 2)
            p1 = json.loads(packets[0].read_text())
            p2 = json.loads(packets[1].read_text())
            wrong_unit = p2["required_editable_unit_ids"][0]
            bad = {
                "schema_version": 4,
                "packet_id": p1["packet_id"],
                "reviewed": True,
                "decisions": [{"unit_id": wrong_unit, "break_after": False}],
            }
            (work / "decisions" / packets[0].name).write_text(json.dumps(bad))
            result = self.run_cli("render", "--manifest", work / "manifest.json", "--output", root / "out.html", "--report", root / "qa.json", expect=2)
            self.assertIn("does not belong to packet", result.stderr)

    def test_old_manifest_without_packet_binding_requires_reprepare(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            manifest = {"packet_ids": ["p0001"]}
            decisions, reviewed, errors = module.load_decisions(manifest, root)
            self.assertFalse(decisions)
            self.assertFalse(reviewed)
            self.assertTrue(any("packet_unit_ids" in error for error in errors))

    def test_optional_boolean_fields_are_type_checked(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            work = root / "work"
            source.write_text('<html><body><p>One. Two.</p></body></html>', encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", work)
            packet_path = next((work / "packets").glob("*.json"))
            packet = json.loads(packet_path.read_text())
            decisions = []
            for unit_id in packet["required_editable_unit_ids"]:
                decisions.append({"unit_id": unit_id, "break_after": False, "standalone": "false"})
            (work / "decisions" / packet_path.name).write_text(json.dumps({"schema_version": 4, "packet_id": packet["packet_id"], "reviewed": True, "decisions": decisions}))
            result = self.run_cli("render", "--manifest", work / "manifest.json", "--output", root / "out.html", "--report", root / "qa.json", expect=2)
            self.assertIn("standalone must be a boolean", result.stderr)


    def test_fragment_and_publication_manifest_outputs(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            work = root / "work"
            output = root / "mobile.html"
            report = root / "qa.json"
            fragment = root / "content.html"
            publication = root / "publication.json"
            source.write_text('<html><head><title>T</title></head><body><main class="book-source"><h2>Chapter</h2><p>One. Two.</p></main></body></html>', encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": True})
            self.run_cli(
                "render", "--manifest", work / "manifest.json", "--output", output, "--report", report,
                "--fragment-output", fragment, "--publication-manifest", publication, "--hard-max-chars", "100",
            )
            self.assertIn("<h2>Chapter</h2>", fragment.read_text())
            self.assertNotIn("<html", fragment.read_text().lower())
            pub = json.loads(publication.read_text())
            self.assertTrue(pub["formal_release"])
            self.assertEqual(pub["content_html_file"], str(fragment.resolve()))

    def test_standardebooks_assets_are_copied_beside_output_and_relinked(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source_dir = root / "source"
            source_dir.mkdir()
            source = source_dir / "working_source.html"
            assets = source_dir / "assets"
            (assets / "images").mkdir(parents=True)
            (assets / "images" / "map.svg").write_text("<svg></svg>", encoding="utf-8")
            source.write_text('<html><body><main><p>One. Two.</p><img src="assets/images/map.svg"></main></body></html>', encoding="utf-8")
            provenance = {
                "schema_version": 4,
                "title": "Demo",
                "author": "Author",
                "selected": {
                    "provider": "standardebooks", "assets_dir": str(assets),
                    "asset_files": module._asset_inventory(assets),
                    "working_source_sha256": module.sha256_bytes(source.read_bytes()),
                },
            }
            (source_dir / "source_manifest.json").write_text(json.dumps(provenance), encoding="utf-8")
            work = root / "work"
            output = root / "published" / "mobile.html"
            report = root / "published" / "qa.json"
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": True})
            self.run_cli("render", "--manifest", work / "manifest.json", "--output", output, "--report", report, "--hard-max-chars", "100")
            rendered = output.read_text()
            self.assertIn('src="mobile.assets/images/map.svg"', rendered)
            self.assertTrue((output.parent / "mobile.assets" / "images" / "map.svg").is_file())

    def test_fragment_asset_prefix_validation(self):
        self.assertEqual(module._normalize_fragment_asset_prefix("/book-assets/demo"), "/book-assets/demo/")
        self.assertEqual(module._normalize_fragment_asset_prefix("https://cdn.example/books/demo"), "https://cdn.example/books/demo/")
        for bad in ("javascript:alert(1)", "//evil.example/x", "../assets", '/x/" onclick="x'):
            with self.subTest(bad=bad), self.assertRaises(module.FormatterError):
                module._normalize_fragment_asset_prefix(bad)

    def test_fragment_asset_prefix_makes_database_fragment_publish_ready(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source_dir = root / "source"
            source_dir.mkdir()
            source = source_dir / "working_source.html"
            assets = source_dir / "assets"
            (assets / "images").mkdir(parents=True)
            (assets / "images" / "map.svg").write_text("<svg></svg>", encoding="utf-8")
            source.write_text('<html><body><main><p>One. Two.</p><img src="assets/images/map.svg"></main></body></html>', encoding="utf-8")
            provenance = {
                "schema_version": 4, "title": "Demo", "author": "Author",
                "selected": {
                    "provider": "standardebooks", "assets_dir": str(assets),
                    "asset_files": module._asset_inventory(assets),
                    "working_source_sha256": module.sha256_bytes(source.read_bytes()),
                },
            }
            (source_dir / "source_manifest.json").write_text(json.dumps(provenance), encoding="utf-8")
            work = root / "work"
            output = root / "published" / "mobile.html"
            report = root / "published" / "qa.json"
            fragment = root / "published" / "content.html"
            publication = root / "published" / "publication.json"
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": True})
            self.run_cli(
                "render", "--manifest", work / "manifest.json", "--output", output, "--report", report,
                "--fragment-output", fragment, "--fragment-asset-prefix", "/book-assets/demo/",
                "--publication-manifest", publication, "--hard-max-chars", "100",
            )
            self.assertIn('src="/book-assets/demo/images/map.svg"', fragment.read_text())
            qa = json.loads(report.read_text())
            self.assertTrue(qa["publishing"]["supabase_database_content_html_ready"])
            self.assertFalse(qa["publishing"]["fragment_assets_require_site_mapping"])
            pub = json.loads(publication.read_text())
            self.assertEqual(pub["fragment_asset_prefix"], "/book-assets/demo/")

    def test_fragment_with_assets_without_prefix_reports_mapping_required(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source_dir = root / "source"
            source_dir.mkdir()
            source = source_dir / "working_source.html"
            assets = source_dir / "assets"
            (assets / "images").mkdir(parents=True)
            (assets / "images" / "map.svg").write_text("<svg></svg>", encoding="utf-8")
            source.write_text('<html><body><main><p>One.</p><img src="assets/images/map.svg"></main></body></html>', encoding="utf-8")
            (source_dir / "source_manifest.json").write_text(json.dumps({
                "schema_version": 4, "title": "Demo", "author": "Author",
                "selected": {
                    "provider": "standardebooks", "assets_dir": str(assets),
                    "asset_files": module._asset_inventory(assets),
                    "working_source_sha256": module.sha256_bytes(source.read_bytes()),
                },
            }), encoding="utf-8")
            work = root / "work"
            report = root / "qa.json"
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": False})
            self.run_cli(
                "render", "--manifest", work / "manifest.json", "--output", root / "mobile.html", "--report", report,
                "--fragment-output", root / "content.html", "--hard-max-chars", "100",
            )
            qa = json.loads(report.read_text())
            self.assertFalse(qa["publishing"]["supabase_database_content_html_ready"])
            self.assertTrue(qa["publishing"]["fragment_assets_require_site_mapping"])
            self.assertTrue(any("asset" in w.lower() for w in qa["warnings"]))

    def test_audit_accepts_crlf_output_without_universal_newline_false_positive(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "working_source.html"
            source.write_bytes(b"<!doctype html>\r\n<html>\r\n<body>\r\n<main><p>One sentence. Another sentence.</p></main>\r\n</body>\r\n</html>\r\n")
            work = root / "work"
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": False})
            report = root / "qa.json"
            output = root / "mobile.html"
            fragment = root / "mobile.content.html"
            publication = root / "mobile.publication.json"
            self.run_cli(
                "render", "--manifest", work / "manifest.json",
                "--output", output, "--fragment-output", fragment,
                "--publication-manifest", publication, "--report", report,
                "--hard-max-chars", "500",
            )
            self.assertIn(b"\r\n", output.read_bytes())
            result = self.run_cli("audit", "--report", report, "--require-formal", expect=0)
            self.assertIn('"passed": true', result.stdout)

    def test_audit_detects_missing_or_changed_published_asset(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source_dir = root / "source"
            source_dir.mkdir()
            source = source_dir / "working_source.html"
            assets = source_dir / "assets"
            (assets / "images").mkdir(parents=True)
            (assets / "images" / "map.svg").write_text("<svg></svg>", encoding="utf-8")
            source.write_text('<html><body><main><p>One.</p><img src="assets/images/map.svg"></main></body></html>', encoding="utf-8")
            (source_dir / "source_manifest.json").write_text(json.dumps({
                "schema_version": 4, "title": "Demo", "author": "Author",
                "selected": {
                    "provider": "standardebooks", "assets_dir": str(assets),
                    "asset_files": module._asset_inventory(assets),
                    "working_source_sha256": module.sha256_bytes(source.read_bytes()),
                },
            }), encoding="utf-8")
            work = root / "work"
            output = root / "mobile.html"
            report = root / "qa.json"
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": False})
            self.run_cli("render", "--manifest", work / "manifest.json", "--output", output, "--report", report, "--hard-max-chars", "100")
            published_asset = root / "mobile.assets" / "images" / "map.svg"
            published_asset.write_text("changed", encoding="utf-8")
            result = self.run_cli("audit", "--report", report, "--require-formal", expect=1)
            self.assertIn("published asset is missing or changed", result.stdout)


    def test_prepare_rejects_invalid_source_manifest_json(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "working_source.html"
            source.write_text('<html><body><p>Text.</p></body></html>', encoding="utf-8")
            (root / "source_manifest.json").write_text("{not-json", encoding="utf-8")
            result = self.run_cli("prepare", source, "--workspace", root / "work", expect=2)
            self.assertIn("source_manifest.json is invalid JSON", result.stderr)

    def test_render_rejects_missing_declared_source_asset_directory(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source_dir = root / "source"
            source_dir.mkdir()
            source = source_dir / "working_source.html"
            assets = source_dir / "assets"
            (assets / "images").mkdir(parents=True)
            (assets / "images" / "map.svg").write_text("<svg></svg>", encoding="utf-8")
            source.write_text('<html><body><p>One.</p><img src="assets/images/map.svg"></body></html>', encoding="utf-8")
            (source_dir / "source_manifest.json").write_text(json.dumps({
                "schema_version": 4, "selected": {
                    "provider": "local", "assets_dir": str(assets),
                    "asset_files": module._asset_inventory(assets),
                    "working_source_sha256": module.sha256_bytes(source.read_bytes()),
                },
            }), encoding="utf-8")
            work = root / "work"
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": False})
            import shutil
            shutil.rmtree(assets)
            result = self.run_cli(
                "render", "--manifest", work / "manifest.json", "--output", root / "mobile.html",
                "--report", root / "qa.json", "--hard-max-chars", "100", expect=2,
            )
            self.assertIn("source asset directory declared by provenance is missing", result.stderr)


    def test_render_refuses_to_delete_foreign_existing_asset_directory(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source_dir = root / "source"
            source_dir.mkdir()
            source = source_dir / "working_source.html"
            assets = source_dir / "assets"
            (assets / "images").mkdir(parents=True)
            (assets / "images" / "map.svg").write_text("<svg></svg>", encoding="utf-8")
            source.write_text('<html><body><p>One.</p><img src="assets/images/map.svg"></body></html>', encoding="utf-8")
            (source_dir / "source_manifest.json").write_text(json.dumps({
                "schema_version": 4, "selected": {
                    "provider": "local", "assets_dir": str(assets),
                    "asset_files": module._asset_inventory(assets),
                    "working_source_sha256": module.sha256_bytes(source.read_bytes()),
                },
            }), encoding="utf-8")
            work = root / "work"
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": False})
            foreign = root / "mobile.assets"
            foreign.mkdir()
            (foreign / "do-not-delete.txt").write_text("mine", encoding="utf-8")
            result = self.run_cli(
                "render", "--manifest", work / "manifest.json", "--output", root / "mobile.html",
                "--report", root / "qa.json", "--hard-max-chars", "100", expect=2,
            )
            self.assertIn("already exists with different contents", result.stderr)
            self.assertEqual((foreign / "do-not-delete.txt").read_text(encoding="utf-8"), "mine")

    def test_audit_detects_untracked_published_asset(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source_dir = root / "source"
            source_dir.mkdir()
            source = source_dir / "working_source.html"
            assets = source_dir / "assets"
            (assets / "images").mkdir(parents=True)
            (assets / "images" / "map.svg").write_text("<svg></svg>", encoding="utf-8")
            source.write_text('<html><body><p>One.</p><img src="assets/images/map.svg"></body></html>', encoding="utf-8")
            (source_dir / "source_manifest.json").write_text(json.dumps({
                "schema_version": 4, "selected": {
                    "provider": "local", "assets_dir": str(assets),
                    "asset_files": module._asset_inventory(assets),
                    "working_source_sha256": module.sha256_bytes(source.read_bytes()),
                },
            }), encoding="utf-8")
            work = root / "work"
            report = root / "qa.json"
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": False})
            self.run_cli("render", "--manifest", work / "manifest.json", "--output", root / "mobile.html", "--report", report, "--hard-max-chars", "100")
            extra = root / "mobile.assets" / "extra.bin"
            extra.write_bytes(b"unexpected")
            result = self.run_cli("audit", "--report", report, "--require-formal", expect=1)
            self.assertIn("untracked files", result.stdout)

    def test_audit_detects_changed_publication_manifest(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.html"
            work = root / "work"
            output = root / "mobile.html"
            report = root / "qa.json"
            publication = root / "publication.json"
            source.write_text('<html><body><p>One. Two.</p></body></html>', encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", work)
            self.write_decisions(work, lambda u, p: {"break_after": True})
            self.run_cli(
                "render", "--manifest", work / "manifest.json", "--output", output, "--report", report,
                "--publication-manifest", publication, "--hard-max-chars", "100",
            )
            qa = json.loads(report.read_text(encoding="utf-8"))
            self.assertEqual(qa["publishing"]["publication_manifest_file"], str(publication.resolve()))
            self.assertTrue(qa["publishing"]["publication_manifest_sha256"])
            publication.write_text("{}", encoding="utf-8")
            result = self.run_cli("audit", "--report", report, "--require-formal", expect=1)
            self.assertIn("publication manifest is missing or changed", result.stdout)


    def test_visible_payload_canonicalization_preserves_word_separation(self):
        self.assertEqual(module.canonical_visible("New  York\nHarbor"), "New York Harbor")
        self.assertNotEqual(module.canonical_visible("New York"), module.canonical_visible("NewYork"))

    def test_mobile_css_does_not_change_visible_payload(self):
        source = '<html><head><title>T</title></head><body><p>Hello &amp; goodbye.</p></body></html>'
        output, injected = module.inject_mobile_css(source)
        self.assertTrue(injected)
        self.assertEqual(module.canonical_visible(module.visible_document_text(source)), module.canonical_visible(module.visible_document_text(output)))

    def test_no_external_runtime_imports(self):
        text = SCRIPT.read_text(encoding="utf-8")
        for forbidden in ("beautifulsoup", "bs4", "lxml", "html5lib", "spacy", "yasbd", "phrasplit"):
            self.assertNotIn(forbidden, text.lower())
        self.assertIn("import text_candidate_tools", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
