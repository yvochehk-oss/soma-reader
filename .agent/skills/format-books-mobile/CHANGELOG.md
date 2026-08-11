# Changelog

## 4.2.2-format-only — 2026-08-10

- 从 `download-reformat-books-mobile v4.2.1` 中独立拆出纯手机排版技能 `format-books-mobile`。
- 删除下载器、完成清单、Google Drive/registry 相关脚本和说明。
- 保留 Agent-first HTML formatter、safe split candidates、formal QA、资源发布与 Cloudflare/Supabase handoff。
- `working_source.html` 可单独作为输入；同目录有 `source_manifest.json` 时继续严格校验 acquisition SHA/provenance。
- 修复 CRLF audit bug：output、content fragment、publication manifest 统一按 raw bytes SHA-256 复核，避免 `read_text()` universal-newline normalization 造成假阳性 changed-file 错误。

## Base

排版核心源自 `download-reformat-books-mobile v4.2.1`。
