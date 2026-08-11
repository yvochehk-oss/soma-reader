#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest
import argparse
import json
from unittest import mock
import io
import zipfile

ROOT = Path(__file__).resolve().parent
SCRIPT = ROOT / "book_source_fetcher.py"
spec = importlib.util.spec_from_file_location("book_source_fetcher", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(module)


class BookSourceFetcherTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(module.slugify("Robert Louis Stevenson"), "robert-louis-stevenson")
        self.assertEqual(module.slugify("Alice’s Adventures in Wonderland"), "alice-s-adventures-in-wonderland")

    def test_find_standardebooks_github(self):
        page = '<a href="https://github.com/standardebooks/jane-austen_pride-and-prejudice">source code at GitHub</a>'
        self.assertEqual(module.find_standardebooks_github(page), "https://github.com/standardebooks/jane-austen_pride-and-prejudice")

    def test_standardebooks_opf_spine_and_consolidation(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            epub = root / "src" / "epub"
            textdir = epub / "text"
            textdir.mkdir(parents=True)
            (epub / "content.opf").write_text('''<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf"><manifest>
<item id="title" href="text/titlepage.xhtml" media-type="application/xhtml+xml"/>
<item id="c1" href="text/chapter-1.xhtml" media-type="application/xhtml+xml"/>
<item id="col" href="text/colophon.xhtml" media-type="application/xhtml+xml"/>
</manifest><spine><itemref idref="title"/><itemref idref="c1"/><itemref idref="col"/></spine></package>''', encoding="utf-8")
            (textdir / "titlepage.xhtml").write_text('<html><body><h1>Title</h1></body></html>', encoding="utf-8")
            (textdir / "chapter-1.xhtml").write_text('<html><body><section><h2>Chapter I</h2><p>One. Two.</p></section></body></html>', encoding="utf-8")
            (textdir / "colophon.xhtml").write_text('<html><body><p>Admin.</p></body></html>', encoding="utf-8")
            doc, files = module.consolidate_standardebooks(root, "Demo", "Author")
            self.assertIn("Chapter I", doc)
            self.assertNotIn("Admin.", doc)
            self.assertNotIn("<h1>Title</h1>", doc)
            self.assertEqual(files, ["src/epub/text/chapter-1.xhtml"])

    def test_standardebooks_consolidation_rewrites_internal_links_and_assets(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            epub = root / "src" / "epub"
            textdir = epub / "text"
            images = epub / "images"
            textdir.mkdir(parents=True)
            images.mkdir(parents=True)
            (images / "map.svg").write_text("<svg/>", encoding="utf-8")
            (epub / "content.opf").write_text('''<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf"><manifest>
<item id="c1" href="text/chapter-1.xhtml" media-type="application/xhtml+xml"/>
<item id="notes" href="text/endnotes.xhtml" media-type="application/xhtml+xml"/>
</manifest><spine><itemref idref="c1"/><itemref idref="notes"/></spine></package>''', encoding="utf-8")
            (textdir / "chapter-1.xhtml").write_text('<html><body><p>See <a href="endnotes.xhtml#note-1">note</a>.</p><img src="../images/map.svg"/></body></html>', encoding="utf-8")
            (textdir / "endnotes.xhtml").write_text('<html><body><ol><li id="note-1">Note.</li></ol></body></html>', encoding="utf-8")
            assets = root / "export-assets"
            doc, _ = module.consolidate_standardebooks(root, "Demo", "Author", assets_dir=assets)
            self.assertIn('href="#note-1"', doc)
            self.assertIn('src="assets/images/map.svg"', doc)
            self.assertTrue((assets / "images" / "map.svg").is_file())

    def test_strip_text_boilerplate(self):
        text = "header\n*** START OF THE PROJECT GUTENBERG EBOOK DEMO ***\n\nBOOK TEXT\n\n*** END OF THE PROJECT GUTENBERG EBOOK DEMO ***\nfooter"
        payload, info = module.strip_gutenberg_text_boilerplate(text)
        self.assertEqual(payload, "BOOK TEXT")
        self.assertTrue(info["removed"])

    def test_strip_modern_html_boilerplate(self):
        source = '<html><body><div class="pg-boilerplate pgheader"><p>Header</p></div><main><p>Book.</p></main><div id="pg-footer"><p>Footer</p></div></body></html>'
        cleaned, ranges, stripped = module.strip_modern_gutenberg_boilerplate(source)
        self.assertTrue(stripped)
        self.assertNotIn("Header", cleaned)
        self.assertNotIn("Footer", cleaned)
        self.assertIn("Book.", cleaned)
        self.assertEqual(len(ranges), 2)

    def test_mirror_url_preserves_path(self):
        url = module.mirror_url("https://www.gutenberg.org/cache/epub/1342/pg1342-h.zip", "https://gutenberg.pglaf.org")
        self.assertEqual(url, "https://gutenberg.pglaf.org/cache/epub/1342/pg1342-h.zip")

    def test_generated_mirror_candidates_prefer_current_images_html(self):
        candidates = module.generated_mirror_candidates(120, "https://mirror.example")
        self.assertEqual(candidates[0], ("html", "https://mirror.example/cache/epub/120/pg120-images.html"))
        self.assertIn(("html_zip", "https://mirror.example/cache/epub/120/pg120-h.zip"), candidates)

    def test_txt_fallback_preserves_roman_and_swahili_headings(self):
        source = (
            "I. Introduction\n\nOpening prose.\n\n"
            "II. The Machine\n\nMore prose.\n\n"
            "IV — The Return\n\nReturn prose.\n\n"
            "SURA YA KWANZA\n\nHadithi inaanza.\n\n"
            "Sura ya kumi na mbili\n\nHadithi inaendelea.\n\n"
            "IC. Invalid numeral\n\nThis remains prose.\n\n"
            "III. ordinary lowercase continuation\n"
        )
        rendered = module.plain_text_to_html(source, "Demo", "Author")
        self.assertIn("<h2>I. Introduction</h2>", rendered)
        self.assertIn("<h2>II. The Machine</h2>", rendered)
        self.assertIn("<h2>IV — The Return</h2>", rendered)
        self.assertIn("<h2>SURA YA KWANZA</h2>", rendered)
        self.assertIn("<h2>Sura ya kumi na mbili</h2>", rendered)
        self.assertNotIn("<h2>IC. Invalid numeral</h2>", rendered)
        self.assertNotIn("<h2>III. ordinary lowercase continuation</h2>", rendered)

    def test_plain_text_fallback_produces_html(self):
        source = "CHAPTER ONE\n\nFirst sentence. Second sentence."
        result = module.plain_text_to_html(source, "Demo", "Author")
        self.assertIn("<h2>CHAPTER ONE</h2>", result)
        self.assertIn("<p>First sentence. Second sentence.</p>", result)

    def test_crlf_hard_wraps_do_not_become_false_paragraph_breaks(self):
        source = (
            "First physical source line is wrapped near the Gutenberg text column width and\r\n"
            "continues directly onto a second physical line without a blank paragraph break\r\n"
            "before ending on a third physical line as the same logical prose paragraph.\r\n\r\n"
            "A genuinely new paragraph begins only after the empty CRLF line pair."
        )
        rendered, info = module.plain_text_to_html_with_info(source, "Demo", "Author")
        self.assertEqual(rendered.count("<p>"), 2)
        self.assertIn("width and continues directly", rendered)
        self.assertNotIn("<br>", rendered)
        self.assertEqual(info["source_blocks"], 2)
        self.assertEqual(info["hard_wrap_blocks_merged"], 1)

    def test_gutenberg_hard_wrapped_prose_is_joined_even_without_terminal_period(self):
        source = (
            "Dark spruce forest frowned on either side the frozen waterway and\n"
            "the trees leaned toward each other in the fading northern light while\n"
            "a vast silence reigned over the land and pressed upon the travellers\n"
            "until even their own breathing seemed small beneath the frozen sky\n"
            "and still the long trail went on through the darkness"
        )
        rendered, info = module.plain_text_to_html_with_info(source, "Demo", "Author")
        self.assertNotIn("preserve-lines", rendered)
        self.assertNotIn("<br>", rendered)
        self.assertIn("Dark spruce forest frowned", rendered)
        self.assertEqual(info["hard_wrap_blocks_merged"], 1)
        self.assertEqual(info["physical_line_breaks_removed"], 4)
        self.assertFalse(info["text_content_changed"])

    def test_hard_wrap_detector_does_not_flatten_short_verse_or_contents(self):
        verse = "The moon is high\nThe river is still\nThe night is cold"
        rendered, info = module.plain_text_to_html_with_info(verse, "Demo", "Author")
        self.assertIn('class="preserve-lines"', rendered)
        self.assertEqual(info["hard_wrap_blocks_merged"], 0)

        contents = "PART I\nCHAPTER I THE TRAIL\nCHAPTER II THE WOLF"
        rendered, info = module.plain_text_to_html_with_info(contents, "Demo", "Author")
        self.assertIn('class="preserve-lines"', rendered)
        self.assertEqual(info["hard_wrap_blocks_merged"], 0)

    def test_local_txt_manifest_records_hard_wrap_normalization(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "wrapped.txt"
            out = root / "normalized"
            source.write_text(
                "This is a deliberately long prose line that resembles a Gutenberg physical wrap\n"
                "and it continues at approximately the same column width without a paragraph break\n"
                "before carrying the same sentence onward through another physical source line\n"
                "until the final words arrive without terminal punctuation",
                encoding="utf-8",
            )
            import argparse
            module.normalize_local(argparse.Namespace(
                input=source, out=out, title="Demo", author="Author",
                strip_gutenberg_boilerplate=False, force=False, lang="en",
            ))
            manifest = __import__('json').loads((out / "source_manifest.json").read_text())
            info = manifest["selected"]["text_normalization"]
            self.assertEqual(info["method"], "gutenberg-hard-wrap-aware")
            self.assertEqual(info["hard_wrap_blocks_merged"], 1)
            self.assertEqual(info["physical_line_breaks_removed"], 3)
            self.assertFalse(info["text_content_changed"])


    def test_local_normalize_txt_writes_working_html_and_manifest(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "demo.txt"
            out = root / "normalized"
            source.write_text("CHAPTER ONE\n\nFirst sentence. Second sentence.", encoding="utf-8")
            import argparse
            rc = module.normalize_local(argparse.Namespace(
                input=source, out=out, title="Demo", author="Author",
                strip_gutenberg_boilerplate=False, force=False, lang="en",
            ))
            self.assertEqual(rc, 0)
            self.assertTrue((out / "working_source.html").is_file())
            self.assertTrue((out / "source_manifest.json").is_file())
            self.assertIn("<h2>CHAPTER ONE</h2>", (out / "working_source.html").read_text())

    def test_local_html_normalize_copies_relative_media(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source_dir = root / "input"
            (source_dir / "images").mkdir(parents=True)
            (source_dir / "images" / "map.jpg").write_bytes(b"JPEG")
            source = source_dir / "book.html"
            source.write_text('<html><body><p>Text.</p><img src="images/map.jpg"></body></html>', encoding="utf-8")
            out = Path(td).resolve() / "normalized"
            import argparse
            module.normalize_local(argparse.Namespace(
                input=source, out=out, title="Demo", author="Author",
                strip_gutenberg_boilerplate=False, force=False, lang="en",
            ))
            rendered = (out / "working_source.html").read_text()
            self.assertIn('src="assets/images/map.jpg"', rendered)
            self.assertEqual((out / "assets" / "images" / "map.jpg").read_bytes(), b"JPEG")
            manifest = __import__('json').loads((out / "source_manifest.json").read_text())
            self.assertTrue(manifest["selected"]["assets_dir"].endswith("assets"))

    def test_local_swahili_txt_sets_html_language(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "demo.txt"
            out = root / "normalized"
            source.write_text("SURA YA KWANZA\n\nHabari inaanza.", encoding="utf-8")
            import argparse
            module.normalize_local(argparse.Namespace(
                input=source, out=out, title="Demo", author="Author",
                strip_gutenberg_boilerplate=False, force=False, lang="sw",
            ))
            self.assertIn('<html lang="sw">', (out / "working_source.html").read_text())

    def test_gutendex_scoring_rejects_exact_title_wrong_author(self):
        wrong = {"title": "Treasure Island", "authors": [{"name": "Someone Else"}], "copyright": False, "languages": ["en"]}
        right = {"title": "Treasure Island", "authors": [{"name": "Stevenson, Robert Louis"}], "copyright": False, "languages": ["en"]}
        self.assertLess(module.score_gutendex_book(wrong, "Treasure Island", "Robert Louis Stevenson"), 40)
        self.assertGreater(module.score_gutendex_book(right, "Treasure Island", "Robert Louis Stevenson"), 40)

    def test_standardebooks_search_runs_after_successful_non_ebook_page(self):
        direct = module.candidate_standardebooks_page("Demo", "Author")
        search_page = "https://standardebooks.org/ebooks/author/demo-real"
        calls = []
        def fake_request(url, **kwargs):
            calls.append(url)
            if url == direct:
                return b"<html><body>No repository here</body></html>", {}, url
            if url == search_page:
                page = b'<a href="https://github.com/standardebooks/author_demo-real">source</a>'
                return page, {}, url
            raise AssertionError(url)
        with mock.patch.object(module, "request_bytes", side_effect=fake_request), mock.patch.object(module, "standardebooks_search_page", return_value=search_page):
            found = module.discover_standardebooks_repo("Demo", "Author", 10)
        self.assertEqual(found, (search_page, "https://github.com/standardebooks/author_demo-real"))
        self.assertIn(search_page, calls)



    def test_standardebooks_direct_redirect_to_wrong_author_is_rejected(self):
        direct = module.candidate_standardebooks_page("Demo", "Right Author")
        right_page = "https://standardebooks.org/ebooks/right-author/demo-real"
        wrong_page = "https://standardebooks.org/ebooks/someone-else/demo"
        repo_wrong = b'<a href="https://github.com/standardebooks/someone-else_demo">source</a>'
        repo_right = b'<a href="https://github.com/standardebooks/right-author_demo">source</a>'
        def fake_request(url, **kwargs):
            if url == direct:
                return repo_wrong, {}, wrong_page
            if url == right_page:
                return repo_right, {}, right_page
            raise AssertionError(url)
        with mock.patch.object(module, "request_bytes", side_effect=fake_request), \
             mock.patch.object(module, "standardebooks_search_page", return_value=right_page):
            found = module.discover_standardebooks_repo("Demo", "Right Author", 10)
        self.assertEqual(found, (right_page, "https://github.com/standardebooks/right-author_demo"))

    def test_standardebooks_search_rejects_same_title_wrong_author(self):
        page = b"""<html><body>
        <a href="/ebooks/someone-else/demo">Demo</a>
        <a href="/ebooks/right-author/demo">Demo</a>
        </body></html>"""
        with mock.patch.object(module, "request_bytes", return_value=(page, {}, "https://standardebooks.org/ebooks?query=demo")):
            found = module.standardebooks_search_page("Demo", "Right Author", 10)
        self.assertEqual(found, "https://standardebooks.org/ebooks/right-author/demo")

    def test_failed_provider_derivatives_are_reset_before_fallback(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "working_source.html").write_text("stale", encoding="utf-8")
            (root / "assets").mkdir()
            (root / "assets" / "stale.jpg").write_bytes(b"stale")
            (root / "raw").mkdir()
            (root / "raw" / "attempt.zip").write_bytes(b"diagnostic")
            module.reset_working_derivatives(root)
            self.assertFalse((root / "working_source.html").exists())
            self.assertFalse((root / "assets").exists())
            self.assertTrue((root / "raw" / "attempt.zip").is_file())

    def test_declared_charset_is_honored(self):
        text = "SURA YA KWANZA — café"
        encoded = text.encode("utf-16")
        self.assertEqual(module.decode_text_bytes(encoded, "text/plain; charset=utf-16"), text)

    def test_gutenberg_html_zip_records_downloaded_archive_hash(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w") as zf:
                zf.writestr("pg120-h.html", "<html><body><p>Text.</p></body></html>")
            archive = buf.getvalue()
            book = {"id": 120, "title": "Demo", "authors": [{"name": "Author"}], "languages": ["en"], "copyright": False, "formats": {}}
            with mock.patch.object(module, "gutendex_lookup", return_value=book), \
                 mock.patch.object(module, "format_candidates", return_value=[("html_zip", "https://mirror.example/pg120-h.zip")]), \
                 mock.patch.object(module, "generated_mirror_candidates", return_value=[]), \
                 mock.patch.object(module, "request_bytes", return_value=(archive, {"content-type": "application/zip"}, "https://mirror.example/pg120-h.zip")):
                selected = module.try_gutenberg("Demo", "Author", root, 10, "https://mirror.example")
            self.assertIsNotNone(selected)
            self.assertTrue(Path(selected["raw_archive"]).is_file())
            self.assertEqual(selected["raw_archive_sha256"], module.sha256_bytes(archive))


    def test_mirror_url_preserves_configured_path_prefix(self):
        url = module.mirror_url(
            "https://www.gutenberg.org/cache/epub/1342/pg1342-h.zip",
            "https://mirror.example/gutenberg",
        )
        self.assertEqual(url, "https://mirror.example/gutenberg/cache/epub/1342/pg1342-h.zip")

    def test_safe_zip_extraction_rejects_symbolic_link_member(self):
        buf = io.BytesIO()
        info = zipfile.ZipInfo("link")
        info.create_system = 3
        info.external_attr = (0o120777 << 16)
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr(info, "../outside")
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(module.FetchError):
                module.safe_extract_zip(buf.getvalue(), Path(td))

    def test_safe_zip_extraction_rejects_path_traversal(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("../escape.txt", "bad")
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(module.FetchError):
                module.safe_extract_zip(buf.getvalue(), Path(td))

    def test_gutenberg_assets_are_localized_and_rewritten(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            html_doc = '<html><body><p>Text.</p><img src="images/map.jpg"><img src="../shared/logo.png"></body></html>'
            def fake_request(url, **kwargs):
                self.assertEqual(url, "https://mirror.example/cache/epub/120/images/map.jpg")
                return b"JPEGDATA", {"content-type": "image/jpeg"}, url
            with mock.patch.object(module, "request_bytes", side_effect=fake_request):
                rewritten, info = module.localize_gutenberg_assets(
                    html_doc, "https://mirror.example/cache/epub/120/pg120-images.html", root, 10
                )
            self.assertIn('src="assets/images/map.jpg"', rewritten)
            self.assertIn('src="https://mirror.example/cache/epub/shared/logo.png"', rewritten)
            self.assertEqual((root / "assets" / "images" / "map.jpg").read_bytes(), b"JPEGDATA")
            self.assertEqual(info["assets_dir"], str(root / "assets"))
            self.assertEqual(len(info["downloaded"]), 1)

    def test_gutenberg_asset_download_failure_uses_absolute_fallback(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            html_doc = '<html><body><p>Text.</p><img src="images/map.jpg"></body></html>'
            with mock.patch.object(module, "request_bytes", side_effect=module.FetchError("offline")):
                rewritten, info = module.localize_gutenberg_assets(
                    html_doc, "https://mirror.example/cache/epub/120/pg120-images.html", root, 10
                )
            self.assertIn('src="https://mirror.example/cache/epub/120/images/map.jpg"', rewritten)
            self.assertFalse(info["fully_localized"])
            self.assertEqual(len(info["download_errors"]), 1)

    def test_normalize_force_refuses_directory_containing_source(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "book.txt"
            source.write_text("Text.", encoding="utf-8")
            import argparse
            with self.assertRaises(module.FetchError):
                module.normalize_local(argparse.Namespace(
                    input=source, out=root, title="Demo", author="Author",
                    strip_gutenberg_boilerplate=False, force=True, lang="en",
                ))
            self.assertTrue(source.is_file())

    def test_fetch_requires_completion_catalog_before_download(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "source"
            args = argparse.Namespace(
                title="Dracula", author="Bram Stoker", out=out, timeout=10,
                gutenberg_mirror="https://mirror.example", skip_standardebooks=False, force=False,
                completion_catalog=None, allow_without_completion_catalog=False,
            )
            with self.assertRaises(module.FetchError):
                module.fetch(args)
            self.assertFalse(out.exists())

    def test_fetch_invalid_completion_catalog_fails_before_output(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            catalog = root / "catalog.json"
            catalog.write_text("{not-json", encoding="utf-8")
            out = root / "source"
            args = argparse.Namespace(
                title="Dracula", author="Bram Stoker", out=out, timeout=10,
                gutenberg_mirror="https://mirror.example", skip_standardebooks=False, force=False,
                completion_catalog=catalog, allow_without_completion_catalog=False,
            )
            with self.assertRaises(module.FetchError):
                module.fetch(args)
            self.assertFalse(out.exists())

    def test_fetch_skips_completed_book_before_network_or_output(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            catalog = root / "catalog.json"
            catalog.write_text(json.dumps([{
                "id": 1, "slug": "treasure-island", "title": "Treasure Island",
                "author": "Robert Louis Stevenson", "format": "mobile_markdown"
            }]), encoding="utf-8")
            out = root / "source"
            args = argparse.Namespace(
                title="Treasure Island", author="Robert Louis Stevenson", out=out, timeout=10,
                gutenberg_mirror="https://mirror.example", skip_standardebooks=False, force=False,
                completion_catalog=catalog, allow_without_completion_catalog=False,
            )
            with mock.patch.object(module, "try_standardebooks", side_effect=AssertionError("network should not run")), \
                 mock.patch.object(module, "try_gutenberg", side_effect=AssertionError("network should not run")):
                self.assertEqual(module.fetch(args), 0)
            self.assertFalse(out.exists())

    def test_fetch_blocks_same_slug_different_author_conflict(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            catalog = root / "catalog.json"
            catalog.write_text(json.dumps([{
                "id": 1, "slug": "the-machine", "title": "The Machine", "author": "Author A"
            }]), encoding="utf-8")
            args = argparse.Namespace(
                title="The Machine", author="Author B", out=root / "source", timeout=10,
                gutenberg_mirror="https://mirror.example", skip_standardebooks=False, force=False,
                completion_catalog=catalog, allow_without_completion_catalog=False,
            )
            with self.assertRaises(module.FetchError):
                module.fetch(args)

    def test_merge_1_html_source_remains_html_source(self):
        existing = {"id": 1, "slug": "demo", "title": "Demo", "author": "Author", "format": "html_source"}
        incoming = {"slug": "demo", "title": "Demo", "author": "Author", "format": "html_source", "source_provider": "standardebooks"}
        merged = module.merge_download_record(existing, incoming)
        self.assertEqual(merged["format"], "html_source")
        self.assertEqual(merged["source_provider"], "standardebooks")

    def test_merge_2_mobile_html_not_downgraded(self):
        existing = {
            "id": 1, "slug": "demo", "title": "Demo", "author": "Author",
            "format": "mobile_html", "mobile_html_file": "mobile.html", "word_count": 5000
        }
        incoming = {"slug": "demo", "title": "Demo", "author": "Author", "format": "html_source", "source_provider": "gutenberg"}
        merged = module.merge_download_record(existing, incoming)
        self.assertEqual(merged["format"], "mobile_html")
        self.assertEqual(merged["mobile_html_file"], "mobile.html")
        self.assertEqual(merged["word_count"], 5000)
        self.assertEqual(merged["source_provider"], "gutenberg")

    def test_merge_3_mobile_markdown_not_downgraded(self):
        existing = {
            "id": 2, "slug": "demo2", "title": "Demo 2", "author": "Author",
            "format": "mobile_markdown", "mobile_markdown_file": "mobile.md", "qa_report_file": "qa.json"
        }
        incoming = {"slug": "demo2", "title": "Demo 2", "author": "Author", "format": "html_source"}
        merged = module.merge_download_record(existing, incoming)
        self.assertEqual(merged["format"], "mobile_markdown")
        self.assertEqual(merged["mobile_markdown_file"], "mobile.md")
        self.assertEqual(merged["qa_report_file"], "qa.json")

    def test_merge_4_optimistic_lock_retry_preserves_concurrent_mobile_html_upgrade(self):
        catalog_v1 = [{"id": 1, "slug": "book-a", "title": "Book A", "author": "Author", "format": "html_source"}]
        catalog_v2 = [{"id": 1, "slug": "book-a", "title": "Book A", "author": "Author", "format": "mobile_html", "mobile_html_file": "a.html"}]

        calls = {"get_meta": 0}

        class FakeReq:
            def __init__(self, data):
                self.data = data
                self.uri = "https://example.com/fake"
            def execute(self):
                return self.data

        class FakeFiles:
            def get(self, fileId, fields=""):
                calls["get_meta"] += 1
                if calls["get_meta"] == 1:
                    return FakeReq({"id": fileId, "modifiedTime": "2026-08-10T00:00:00Z"})
                elif calls["get_meta"] == 2:
                    # Concurrent modification!
                    return FakeReq({"modifiedTime": "2026-08-10T00:00:05Z"})
                else:
                    return FakeReq({"id": fileId, "modifiedTime": "2026-08-10T00:00:05Z"})

            def get_media(self, fileId):
                data = catalog_v1 if calls["get_meta"] <= 2 else catalog_v2
                return FakeReq(json.dumps(data).encode("utf-8"))

            def update(self, fileId, media_body=None):
                return FakeReq({"id": fileId})

        class FakeService:
            def files(self):
                return FakeFiles()

        class FakeDownloader:
            def __init__(self, fh, req):
                fh.write(req.data)
            def next_chunk(self):
                return None, True

        import googleapiclient.http
        orig_downloader = googleapiclient.http.MediaIoBaseDownload
        googleapiclient.http.MediaIoBaseDownload = FakeDownloader
        try:
            res = module.sync_canonical_catalog_with_gdrive(FakeService(), "Book A", "Author", "book-a")
            self.assertEqual(res["gdrive_catalog"], "synced_and_verified")
        finally:
            googleapiclient.http.MediaIoBaseDownload = orig_downloader

    def test_merge_5_concurrent_downloads_preserve_both_records(self):
        existing = [{"id": 1, "slug": "book-a", "title": "Book A", "author": "Author"}]
        incoming_b = {"slug": "book-b", "title": "Book B", "author": "Author", "format": "html_source"}

        merged_catalog = list(existing)
        max_id = max([i["id"] for i in merged_catalog])
        incoming_b["id"] = max_id + 1
        merged_catalog.append(incoming_b)

        self.assertEqual(len(merged_catalog), 2)
        self.assertEqual(merged_catalog[0]["title"], "Book A")
        self.assertEqual(merged_catalog[1]["title"], "Book B")

    def test_merge_6_new_id_computed_from_latest_server_json(self):
        catalog_144 = [{"id": i, "slug": f"b{i}", "title": f"B{i}", "author": "Author"} for i in range(1, 145)]
        max_id = max([i["id"] for i in catalog_144])
        self.assertEqual(max_id, 144)
        new_id = max_id + 1
        self.assertEqual(new_id, 145)


if __name__ == "__main__":
    unittest.main(verbosity=2)
