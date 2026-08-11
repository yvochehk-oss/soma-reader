# format-books-mobile v4.2.2-format-only

这是从 `download-reformat-books-mobile` 中拆出的**纯排版技能**。

它只接收已经准备好的 `working_source.html`，由 Agent 逐段决定手机阅读段落边界，再由零依赖 Python 工具执行、校验并输出 HTML。

## 不包含

- 公版书搜索/下载
- Standard Ebooks / Gutenberg 获取器
- Google Drive 操作
- `classics_catalog.json` 去重/写回
- 完成状态登记

## 包含

- `scripts/html_mobile_formatter.py`：prepare / render / audit
- `scripts/text_candidate_tools.py`：候选句界/安全分段辅助
- `references/decision-protocol.md`：Agent 决策协议
- `references/backend-notes.md`：HTML-native 技术说明
- `references/publishing-html.md`：Cloudflare / Supabase 发布说明
- `scripts/test_html_mobile_formatter.py`：回归测试

## 最短使用方式

```bash
python3 scripts/html_mobile_formatter.py prepare \
  BOOK_source/working_source.html \
  --workspace BOOK_mobile_work \
  --lang en
```

Agent 完成 `decisions/*.json` 后：

```bash
python3 scripts/html_mobile_formatter.py render \
  --manifest BOOK_mobile_work/manifest.json \
  --output "mobile_Book.html" \
  --fragment-output "mobile_Book.content.html" \
  --publication-manifest "mobile_Book.publication.json" \
  --report "mobile_Book.qa.json"

python3 scripts/html_mobile_formatter.py audit \
  --report "mobile_Book.qa.json" \
  --require-formal
```

最终 formal 输出必须保证正文可见文本不变、HTML 安全、所有 Agent unit 决策完整、无 hard-max 超限。

### v4.2.2-format-only 修复

Formal audit 对 output/fragment/publication manifest 改为按**原始文件 bytes**做 SHA-256 校验，修复 CRLF 文件被 Python 文本模式自动转换换行后出现的误报。
