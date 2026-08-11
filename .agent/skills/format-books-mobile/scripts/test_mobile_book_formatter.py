#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("mobile_book_formatter.py")


def load_module():
    spec = importlib.util.spec_from_file_location("mobile_formatter_v3", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["mobile_formatter_v3"] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class FormatterV3Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def run_cli(self, *args, expect=0):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), *map(str, args)],
            text=True,
            capture_output=True,
        )
        if result.returncode != expect:
            self.fail(
                f"CLI return code {result.returncode}, expected {expect}\n"
                f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
            )
        return result

    def write_complete_decisions(self, workspace: Path, chooser=None):
        chooser = chooser or (lambda unit, packet: {"break_after": True})
        for packet_path in sorted((workspace / "packets").glob("*.json")):
            packet = json.loads(packet_path.read_text(encoding="utf-8"))
            units = {u["id"]: u for u in packet["units"]}
            decisions = []
            for unit_id in packet["required_editable_unit_ids"]:
                decision = {"unit_id": unit_id, "importance": "normal", "reason": "Agent reviewed context."}
                decision.update(chooser(units[unit_id], packet))
                decisions.append(decision)
            payload = {
                "schema_version": 3,
                "packet_id": packet["packet_id"],
                "reviewed": True,
                "decisions": decisions,
            }
            (workspace / "decisions" / packet_path.name).write_text(json.dumps(payload), encoding="utf-8")

    def test_builtin_sentence_candidates_handle_common_cases(self):
        m = self.module
        text = "Dr. Smith paid 3.14 dollars. He arrived at 8 p.m. He stayed. Visit example.com today."
        spans = m.sentence_spans(text, "en")
        values = [m.inline(text[a:b]) for a, b in spans]
        self.assertIn("Dr. Smith paid 3.14 dollars.", values)
        self.assertIn("He arrived at 8 p.m.", values)
        self.assertIn("He stayed.", values)
        self.assertTrue(any("example.com" in value for value in values))

    def test_dialogue_attribution_stays_addressable_together(self):
        m = self.module
        text = '“Are you coming?” he asked. “Ndiyo,” alisema. Then they left.'
        values = [m.inline(text[a:b]) for a, b in m.sentence_spans(text, "sw")]
        self.assertEqual(values[0], '“Are you coming?” he asked.')
        self.assertEqual(values[1], '“Ndiyo,” alisema.')

    def test_heading_detection_expanded(self):
        m = self.module
        self.assertEqual(m.classify_block("CHAPTER ONE", 20), "heading")
        self.assertEqual(m.classify_block("CHAPTER THE FIRST", 20), "heading")
        self.assertEqual(m.classify_block("SURA YA KWANZA", 20), "heading")
        self.assertEqual(m.classify_block("Sura ya kumi na mbili", 20), "heading")

    def test_internal_bom_is_preserved_not_deleted(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.txt"
            workspace = root / "work"
            source.write_bytes(b"\xef\xbb\xbfTITLE\n\nA\xef\xbb\xbfB. End.")
            self.run_cli("prepare", source, "--workspace", workspace, "--lang", "en")
            manifest = json.loads((workspace / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["internal_u_feff_count"], 1)
            self.assertTrue(any("\ufeff" in unit["text"] for unit in manifest["units"]))
            self.assertTrue(manifest["span_coverage"]["ok"])

    def test_agent_controls_normal_paragraph_boundaries(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.txt"
            workspace = root / "work"
            output = root / "mobile.md"
            report = root / "qa.json"
            source.write_text(
                "CHAPTER ONE\n\nFirst sentence. Second sentence. Third sentence. Fourth sentence.",
                encoding="utf-8",
            )
            self.run_cli("prepare", source, "--workspace", workspace, "--lang", "en")
            editable = []
            for packet_path in sorted((workspace / "packets").glob("*.json")):
                packet = json.loads(packet_path.read_text(encoding="utf-8"))
                editable.extend(packet["required_editable_unit_ids"])
            self.assertEqual(len(editable), 4)

            def chooser(unit, packet):
                # Explicitly group sentences 1+2, then 3+4. The script must not
                # override this with a rhythm heuristic.
                idx = packet["required_editable_unit_ids"].index(unit["id"])
                return {"break_after": idx in {1, 3}}

            self.write_complete_decisions(workspace, chooser)
            self.run_cli("render", "--manifest", workspace / "manifest.json", "--output", output, "--report", report)
            rendered = output.read_text(encoding="utf-8")
            self.assertIn("First sentence. Second sentence.\n\nThird sentence. Fourth sentence.", rendered)
            data = json.loads(report.read_text(encoding="utf-8"))
            self.assertTrue(data["formal_release"])
            self.assertFalse(data["script_semantic_autonomy"])
            self.assertEqual(data["prose_paragraphs"], 2)

    def test_formal_render_requires_complete_agent_coverage(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.txt"
            workspace = root / "work"
            source.write_text("One sentence. Two sentence.", encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", workspace)
            packet_path = next((workspace / "packets").glob("*.json"))
            packet = json.loads(packet_path.read_text(encoding="utf-8"))
            first = packet["required_editable_unit_ids"][0]
            partial = {
                "schema_version": 3,
                "packet_id": packet["packet_id"],
                "reviewed": True,
                "decisions": [{"unit_id": first, "break_after": True, "reason": "Reviewed."}],
            }
            (workspace / "decisions" / packet_path.name).write_text(json.dumps(partial), encoding="utf-8")
            result = self.run_cli(
                "render", "--manifest", workspace / "manifest.json",
                "--output", root / "mobile.md", "--report", root / "qa.json", expect=2,
            )
            self.assertIn("editable units without explicit Agent decisions", result.stderr)

    def test_pivotal_dialogue_forces_standalone(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "riwaya.txt"
            workspace = root / "work"
            output = root / "mobile.md"
            report = root / "qa.json"
            source.write_text('Alisubiri. “Hapana!” Mikono yake ilitetemeka.', encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", workspace, "--lang", "sw")

            def chooser(unit, packet):
                if unit["display_text"] == '“Hapana!”':
                    return {"break_after": False, "importance": "pivotal_dialogue"}
                return {"break_after": False}

            self.write_complete_decisions(workspace, chooser)
            self.run_cli("render", "--manifest", workspace / "manifest.json", "--output", output, "--report", report)
            rendered = output.read_text(encoding="utf-8")
            self.assertIn('Alisubiri.\n\n“Hapana!”\n\nMikono yake ilitetemeka.', rendered)
            data = json.loads(report.read_text(encoding="utf-8"))
            self.assertEqual(data["pivotal_standalone_violations"], [])

    def test_long_sentence_requires_agent_selected_split(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "long.txt"
            workspace = root / "work"
            output = root / "mobile.md"
            report = root / "qa.json"
            long_text = (
                "He crossed the courtyard, carrying the letter he had refused to open for three days, "
                "because every time he touched the seal he remembered the promise he had made; "
                "yet the bells were already ringing, and the train would leave before dawn, "
                "so he finally stopped beneath the lamp and broke the wax with his thumb."
            )
            source.write_text(long_text, encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", workspace)
            packet_path = next((workspace / "packets").glob("*.json"))
            packet = json.loads(packet_path.read_text(encoding="utf-8"))
            unit = next(u for u in packet["units"] if u["editable"])
            self.assertTrue(unit["split_candidates"])

            no_split = {
                "schema_version": 3,
                "packet_id": packet["packet_id"],
                "reviewed": True,
                "decisions": [{"unit_id": unit["id"], "break_after": True, "reason": "Reviewed."}],
            }
            (workspace / "decisions" / packet_path.name).write_text(json.dumps(no_split), encoding="utf-8")
            self.run_cli(
                "render", "--manifest", workspace / "manifest.json", "--output", output, "--report", report,
                "--hard-max-chars", "150", "--soft-max-chars", "120", expect=2,
            )

            candidates = [c["offset"] for c in unit["split_candidates"] if c["source"] == "punctuation"]
            # Select all useful punctuation candidates; the Agent is allowed to
            # choose fewer in real work after semantic review.
            with_split = {
                "schema_version": 3,
                "packet_id": packet["packet_id"],
                "reviewed": True,
                "decisions": [{
                    "unit_id": unit["id"], "break_after": True,
                    "split_after_offsets": candidates,
                    "reason": "Agent selected natural clause boundaries for mobile width."
                }],
            }
            (workspace / "decisions" / packet_path.name).write_text(json.dumps(with_split), encoding="utf-8")
            self.run_cli(
                "render", "--manifest", workspace / "manifest.json", "--output", output, "--report", report,
                "--hard-max-chars", "150", "--soft-max-chars", "120",
            )
            data = json.loads(report.read_text(encoding="utf-8"))
            self.assertTrue(data["formal_release"])
            self.assertTrue(data["agent_selected_internal_splits"])

    def test_markdown_structures_are_protected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.md"
            workspace = root / "work"
            original = (
                "---\ntitle: Demo\n---\n\n# Existing Heading\n\n"
                "Paragraph one. Paragraph two.\n\n"
                "```text\nline one\n\nline two\n```\n\n"
                "> quoted line\n> second line\n\n"
                "| A | B |\n| --- | --- |\n| 1 | 2 |\n"
            )
            source.write_text(original, encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", workspace, "--source-format", "markdown")
            manifest = json.loads((workspace / "manifest.json").read_text(encoding="utf-8"))
            kinds = [block["kind"] for block in manifest["blocks"]]
            self.assertIn("yaml_front_matter", kinds)
            self.assertIn("fenced_code", kinds)
            self.assertIn("blockquote", kinds)
            self.assertIn("table", kinds)
            fence = next(block for block in manifest["blocks"] if block["kind"] == "fenced_code")
            self.assertIn("line one\n\nline two", fence["text"])
            self.assertTrue(manifest["span_coverage"]["ok"])

    def test_crlf_soft_wrap_is_not_blank_paragraph(self):
        source = "First wrapped line\r\ncontinues same paragraph.\r\n\r\nSecond paragraph.\r\n"
        blocks = self.module.split_blocks(source, "plain")
        self.assertEqual(len(blocks), 2)
        self.assertIn("\r\n", blocks[0]["text"])
        self.assertEqual(self.module.canonical(source), self.module.canonical("\n\n".join(b["text"] for b in blocks)))

    def test_toc_and_byline_structure(self):
        m = self.module
        source = (
            "THE YELLOW FAIRY BOOK\r\n\r\nBy Various\r\n\r\nCONTENTS\r\n\r\n"
            "THE CAT AND THE MOUSE\r\nTHE SIX SWANS\r\nTHE DRAGON\r\n\r\n"
            "THE YELLOW FAIRY BOOK\r\n\r\nTHE CAT AND THE MOUSE\r\n\r\nStory text.\r\n"
        )
        blocks = m.split_blocks(source, "plain")
        self.assertEqual(blocks[0]["kind"], "heading")
        self.assertEqual(blocks[1]["kind"], "prose")
        self.assertTrue(any(b["kind"] == "toc" for b in blocks))
        repeated = [b for b in blocks if m.inline(b["text"]) == "THE CAT AND THE MOUSE"]
        self.assertEqual(repeated[-1]["kind"], "heading")

    def test_no_third_party_imports_or_requirements_needed(self):
        text = SCRIPT.read_text(encoding="utf-8")
        for forbidden in ("yasbd", "phrasplit", "spacy", "regex import", "from regex"):
            self.assertNotIn(forbidden, text.lower())
        self.assertIn("runtime_dependencies", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
