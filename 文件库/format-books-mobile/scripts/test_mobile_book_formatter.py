#!/usr/bin/env python3

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("mobile_book_formatter.py")


class BookFormatterIntegrationTests(unittest.TestCase):
    def run_cli(self, *args: object, expect: int = 0) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            [sys.executable, str(SCRIPT), *(str(arg) for arg in args)],
            text=True,
            capture_output=True,
        )
        self.assertEqual(result.returncode, expect, result.stderr or result.stdout)
        return result

    def test_reviewed_render_is_integral_and_bounded(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "book.txt"
            workspace = root / "work"
            output = root / "mobile.md"
            report = root / "mobile.qa.json"
            source_text = (
                "A CLASSIC STORY\n\n"
                "CHAPTER I. The Arrival\n\n"
                "The rain crossed the empty square in silver sheets. The station clock stopped at midnight. "
                "Every window was dark, and the road behind the traveller had already vanished beneath the water. "
                "He waited beneath the awning and listened for footsteps that did not come.\n\n"
                "“No!” She struck the locked door with both hands. No one answered.\n\n"
                "“You knew I would return?” she asked. He did not answer at once. “I hoped you would,” he said. "
                "The words changed the silence between them.\n\n"
                "- first item\n- second item\n"
            )
            source.write_text(source_text, encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", workspace, "--engine", "fallback", "--batch-chars", 1000)
            packet = json.loads((workspace / "packets" / "p0001.json").read_text(encoding="utf-8"))
            dialogue = next(unit for unit in packet["units"] if unit["display_text"] == "“No!”")
            decision = {
                "schema_version": 1,
                "packet_id": "p0001",
                "reviewed": True,
                "decisions": [
                    {
                        "unit_id": dialogue["id"],
                        "importance": "pivotal_dialogue",
                        "reason": "The refusal is the decisive beat in the confrontation.",
                    }
                ],
            }
            (workspace / "decisions" / "p0001.json").write_text(json.dumps(decision), encoding="utf-8")
            self.run_cli(
                "render",
                "--manifest",
                workspace / "manifest.json",
                "--output",
                output,
                "--report",
                report,
                "--hard-max-chars",
                220,
                "--soft-max-chars",
                200,
                "--min-chars",
                100,
                "--rhythm-targets",
                "140,200,120",
            )
            data = json.loads(report.read_text(encoding="utf-8"))
            self.assertTrue(data["formal_release"])
            self.assertTrue(data["content_integrity"])
            self.assertEqual(data["prose_over_hard_max"], 0)
            self.assertEqual(data["pivotal_standalone_violations"], [])
            self.assertEqual(data["pivotal_units"], 1)
            self.assertLessEqual(data["prose_max_chars"], 220)
            rendered = output.read_text(encoding="utf-8")
            self.assertIn("“No!”\n\nShe struck the locked door", rendered)
            self.assertIn("- first item\n- second item", rendered)
            self.run_cli("audit", "--report", report, "--require-formal")

    def test_report_cannot_overwrite_source(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.txt"
            workspace = root / "work"
            output = root / "mobile.md"
            original = "CHAPTER I\n\nA plain sentence."
            source.write_text(original, encoding="utf-8")
            self.run_cli("prepare", source, "--workspace", workspace, "--engine", "fallback", "--batch-chars", 1000)
            decision = {"schema_version": 1, "packet_id": "p0001", "reviewed": True, "decisions": []}
            (workspace / "decisions" / "p0001.json").write_text(json.dumps(decision), encoding="utf-8")
            self.run_cli(
                "render",
                "--manifest",
                workspace / "manifest.json",
                "--output",
                output,
                "--report",
                source,
                expect=2,
            )
            self.assertEqual(source.read_text(encoding="utf-8"), original)
            self.assertFalse(output.exists())

    def test_swahili_pivotal_dialogue_and_interiority_are_standalone(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "riwaya.md"
            workspace = root / "work"
            output = root / "riwaya_mobile.md"
            report = root / "riwaya_mobile.qa.json"
            source.write_text(
                "SURA YA 1\n\n"
                "Alijua kwamba akifungua mlango huo, maisha yake yangebadilika milele. “Hapana!” "
                "Aliurudia moyo wake, lakini mikono yake iliendelea kutetemeka.\n\n"
                "**“Choma nyumba.” “Usimwache.”**\n",
                encoding="utf-8",
            )
            self.run_cli("prepare", source, "--workspace", workspace, "--engine", "fallback", "--source-format", "markdown", "--batch-chars", 1000)
            packet = json.loads((workspace / "packets" / "p0001.json").read_text(encoding="utf-8"))
            thought = next(unit for unit in packet["units"] if unit["display_text"].startswith("Alijua kwamba"))
            refusal = next(unit for unit in packet["units"] if unit["display_text"] == "“Hapana!”")
            order = next(unit for unit in packet["units"] if "Choma nyumba" in unit["display_text"])
            threat = next(unit for unit in packet["units"] if "Usimwache" in unit["display_text"])
            decision = {
                "schema_version": 1,
                "packet_id": "p0001",
                "reviewed": True,
                "decisions": [
                    {
                        "unit_id": thought["id"],
                        "importance": "pivotal_interiority",
                        "reason": "Uamuzi huu unabadilisha mwelekeo wa tukio.",
                    },
                    {
                        "unit_id": refusal["id"],
                        "importance": "pivotal_dialogue",
                        "reason": "Neno hili ni kilele cha mgogoro wa ndani.",
                    },
                    {
                        "unit_id": order["id"],
                        "importance": "pivotal_dialogue",
                        "reason": "Amri ya uchomaji ni hatua ya uhalifu isiyoweza kurudishwa nyuma.",
                    },
                    {
                        "unit_id": threat["id"],
                        "importance": "pivotal_dialogue",
                        "reason": "Amri hii inaongeza tishio la moja kwa moja.",
                    },
                ],
            }
            (workspace / "decisions" / "p0001.json").write_text(json.dumps(decision), encoding="utf-8")
            self.run_cli("render", "--manifest", workspace / "manifest.json", "--output", output, "--report", report)
            rendered = output.read_text(encoding="utf-8")
            self.assertIn("Alijua kwamba akifungua mlango huo, maisha yake yangebadilika milele.\n\n“Hapana!”\n\n", rendered)
            self.assertIn("**“Choma nyumba.”**\n\n**“Usimwache.”**", rendered)
            data = json.loads(report.read_text(encoding="utf-8"))
            self.assertEqual(data["pivotal_units"], 4)
            self.assertEqual(data["pivotal_standalone_violations"], [])
            self.assertGreater(data["synthetic_markdown_emphasis_markers"], 0)
            self.assertEqual(data["unbalanced_markdown_blocks"], [])
            self.run_cli("audit", "--report", report, "--require-formal")

    def test_attached_chapter_heading_is_repaired_without_splitting_h2(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "book.md"
            workspace = root / "work"
            output = root / "mobile.md"
            report = root / "mobile.qa.json"
            source.write_text(
                "Opening sentence.\n# Chapter Two: The Turn\n\n"
                "The next scene begins here.\n\n"
                "## Sura ya 3\n\n"
                "Mwisho wa jaribio.\n",
                encoding="utf-8",
            )
            self.run_cli(
                "prepare",
                source,
                "--workspace",
                workspace,
                "--engine",
                "fallback",
                "--source-format",
                "markdown",
                "--batch-chars",
                1000,
            )
            packet = json.loads((workspace / "packets" / "p0001.json").read_text(encoding="utf-8"))
            decision = {
                "schema_version": 1,
                "packet_id": packet["packet_id"],
                "reviewed": True,
                "decisions": [],
            }
            (workspace / "decisions" / "p0001.json").write_text(json.dumps(decision), encoding="utf-8")
            self.run_cli("render", "--manifest", workspace / "manifest.json", "--output", output, "--report", report)
            rendered = output.read_text(encoding="utf-8")
            self.assertIn("Opening sentence. \n\n# Chapter Two: The Turn", rendered)
            self.assertIn("## Sura ya 3", rendered)
            self.assertNotIn("#\n\n# Sura ya 3", rendered)
            self.run_cli("audit", "--report", report, "--require-formal")


if __name__ == "__main__":
    unittest.main()
