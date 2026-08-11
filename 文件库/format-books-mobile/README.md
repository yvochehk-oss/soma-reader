# format-books-mobile

英语和斯瓦希里语小说的手机阅读排版 skill。

本目录是一个独立副本，包含：

- `SKILL.md`：使用规则和验收标准
- `references/decision-protocol.md`：重点句判断协议
- `scripts/mobile_book_formatter.py`：准备、渲染和审计脚本
- `scripts/test_mobile_book_formatter.py`：自动测试
- `agents/openai.yaml`：在支持 skill agent 配置的环境中使用的显示信息

脚本命令从本目录执行，例如：

```bash
cd /path/to/format-books-mobile
python scripts/mobile_book_formatter.py audit --report BOOK.qa.json --require-formal
```

规则是原文零改写，只调整空白、段落边界和必要的 Markdown 结构；重点对白、重点描写和心理活动可以强制独立成段。
