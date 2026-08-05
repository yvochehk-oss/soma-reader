# Lossless Mobile Novel Formatter

将英文小说重新排版为更适合手机阅读的段落，同时严格保持所有非空白字符、顺序和次数不变。

## 安装

程序优先使用成熟的句子边界工具 `syntok`：

```bash
python -m pip install syntok
```

未安装时程序会自动使用保守回退扫描器，并在 QA 报告中报警；生产处理建议安装 `syntok`，或用 `--engine syntok` 强制检查依赖。

## 使用

```bash
python format_novel.py full_story.txt \
  --output full_story_mobile.txt \
  --report full_story_mobile.qa.json \
  --target-words 28 \
  --max-words 60 \
  --max-sentences 3 \
  --verify-integrity strict
```

默认模式遵循现代英语网文的手机阅读原则：目标段落约 20–40 词，硬上限 60 词，最多 3 句；短动作、情绪转折和 punchline 更容易形成短段，连续对白在不超限时保持在一起。程序不随机拆分，结果可复现。普通正文按 `syntok` 句子边界合并；标题、对白、诗歌、书信、列表和场景分隔会被保留为独立结构。严格模式在字符校验失败时不会写出结果。

## 重要限制

这是“无损空白重排”工具，不是语义改写器。它不会翻译、删改或润色正文。诗歌识别是启发式的，正式出版前应检查 QA 报告中的段落分类。

## QA

报告包含输入/输出字符数、去空白后的字符数、词数、段落数、句子引擎、警告和错误。核心验收条件是：

```text
remove_whitespace(input) == remove_whitespace(output)
```

这比单纯比较词数更严格，能够发现丢字、重复和正文字符变更。

