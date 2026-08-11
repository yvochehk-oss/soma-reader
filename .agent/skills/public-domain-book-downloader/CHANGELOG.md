# Changelog

## 1.0.0

- Extracted the acquisition/source-normalization layer from `download-reformat-books-mobile v4.2.1`.
- Kept Standard Ebooks → Project Gutenberg HTML → Gutenberg TXT source priority.
- Kept raw-source preservation, asset localization, SHA-256 manifesting and safe ZIP extraction.
- Kept v4.2.1 Gutenberg hard-wrapped TXT reflow fix.
- Reduced completion registry support to read-only local duplicate checking.
- Added macOS `download_book.command` and shell `download_book.sh` helpers.
- Removed all mobile formatting, Agent paragraph-decision, publishing and registry-write functionality.
