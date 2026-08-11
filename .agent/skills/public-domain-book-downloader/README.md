# Public Domain Book Downloader v1.0.0

独立的公版英文书下载技能，从 `download-reformat-books-mobile v4.2.1` 中拆出。

## 它只负责

- 查找最佳公版书源。
- Standard Ebooks XHTML 优先。
- Gutenberg HTML 次优先。
- UTF-8 TXT 最后兜底。
- 下载并保留原始文件。
- 下载/复制插图等资源。
- 生成 `working_source.html`。
- 生成带 SHA-256、来源、下载过程的 `source_manifest.json`。
- 可读取本地 `classics_catalog.json`，避免重复下载。
- 包含 Gutenberg TXT 硬换行自动重流修复。

## 它不负责

- 手机段落重排。
- Agent 段落决策。
- formal audit / publication QA。
- Google Drive 上传或清单回写。
- Supabase / Cloudflare 发布。

## 最简单运行

```bash
cd public-domain-book-downloader-v1.0.0
./download_book.sh "The Wind in the Willows" "Kenneth Grahame" ./downloads/wind
```

或者直接双击 macOS 的 `download_book.command`。

详细参数见 `SKILL.md`。
