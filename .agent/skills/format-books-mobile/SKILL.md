---
name: format-books-mobile
description: Agent-first, HTML-native mobile reformatting for already-acquired English or Swahili books. Consume an existing working_source.html (and source_manifest.json/assets when present), expose safe paragraph split offsets, require the AI Agent to explicitly decide every editable prose boundary, render phone-first HTML without rewriting prose, preserve illustrations/assets, verify visible-text integrity and HTML security, and emit formal QA plus Cloudflare/Supabase publication artifacts. This skill does not download books, query/update completion registries, or write Google Drive catalogs.
---

# Format Books Mobile — Agent 手机排版独立技能 v4.3.0 (Semantic Paragraph + Visual Soft-Break)

把**已经下载/整理好的 `working_source.html`**重新排成适合手机阅读的高保真 HTML。本技能采用**三层排版架构（The 3-Tier Architecture）**：

1. **第一层（底层语义段）**：原书的 `<p>` 100% 绝对保留！作者换段才允许 `</p><p>`，绝不因逗号、分号或长句而破坏原作者段落结构。
2. **第二层（句间呼吸停顿 `sentence`）**：在原 `<p>` 内部完整句结束（`. ! ? ...`）处，插入 `<span class="mobile-soft-break sentence" aria-hidden="true"></span>`（CSS `height: 0.65em; display: block;`）。
3. **第三层（从句/复合句软断点 `clause`）**：在复合句、分号（`;`）、冒号（`:`）、主从句关联词处插入 `<span class="mobile-soft-break clause" aria-hidden="true"></span>`（CSS `height: 0.28em; display: block;`），仅提供微视觉间隔，绝不伪造新 `<p>`。

正式输出是 HTML，不是 Markdown/TXT。

## 输入契约

推荐输入目录：

```text
BOOK_source/
├── working_source.html          # 必需
├── source_manifest.json         # 可选但强烈推荐；存在时会校验 working_source SHA
└── assets/                      # 可选；若 manifest 登记了资产，发布时会复制并校验
```

## 核心架构

```text
working_source.html
   ↓
prepare：扫描显式 <p>，建立安全 raw HTML offset
   ↓
packets/*.json
   ↓
Agent 逐包阅读上下文，决定句间与从句 soft-break 边界
   ↓
decisions/*.json
   ↓
render：保留 100% 原始 <p class="source-paragraph">，注入 soft-break 与 3-tier 呼吸感 CSS
   ↓
visible-text integrity + 100% 段落恢复度 + HTML 结构/安全 QA
   ↓
mobile_<book>.html
   ├─ mobile_<book>.content.html
   ├─ mobile_<book>.qa.json
   └─ mobile_<book>.publication.json
```

## 核心规则与 QA 门槛 (Hard Gates)

1. **可逆无损性**：删除所有 `.mobile-soft-break` 标签后，必须 100% 无损还原原始段落 HTML 结构。
2. **无障碍与文本不变**：`span.mobile-soft-break` 拥有 `aria-hidden="true"` 且不含任何文本，`visible payload SHA` 保持 100% 一致。
3. **容许长句原则**：字符长度只触发审查，不强制切割；若无 safe semantic candidate，宁可保留长句，绝不伪造新 `<p>`！

## 角色分工（强制）

**Agent 是主要排版编辑；Python 只负责地址化、执行与验证。**

脚本可以：

- 识别现有 HTML `<p>`；
- 暴露句子/从句的安全 split candidate offsets；
- 保护 inline markup、诗歌、表格、代码等结构；
- 检查决策覆盖率；
- 插入 Agent 明确选择的 `<p>` 边界；
- 注入手机阅读 CSS；
- 保留并复制图片/插图等已登记资产；
- 检查 visible-text payload、HTML 结构和安全；
- 输出 full HTML、content fragment、QA 和 publication manifest。

脚本不能：

- 用字符数、正则或随机节奏替代 Agent 决策；
- 自动改写、润色、纠错、现代化拼写或标点；
- 在 formal mode 自动切开未审核的长句。

## 运行依赖

只需 Python 3 标准库，不要 `pip install`。

## 标准工作流

### 1. Prepare

```bash
python3 scripts/html_mobile_formatter.py prepare \
  BOOK_source/working_source.html \
  --workspace BOOK_mobile_work \
  --lang en
```

斯瓦希里语使用：

```bash
--lang sw
```

`prepare` 会：

1. 若同目录存在 `source_manifest.json`，验证其中的 `selected.working_source_sha256`；
2. 做 HTML 结构和安全 preflight；
3. 扫描显式 `<p>`；
4. 把可编辑 prose 拆成 addressable units；
5. 输出 `packets/pNNNN.json`；
6. 建立 `manifest.json`，锁定输入 SHA。

### 2. Agent 决策

先完整阅读：

`references/decision-protocol.md`

然后按 packet 数字顺序逐个读取。对 `required_editable_unit_ids` 中的**每个 unit**写一条明确决策：

```json
{
  "unit_id": "u000001_0000",
  "break_after": true,
  "importance": "normal",
  "reason": "Focus shifts to a new action beat."
}
```

需要句内拆分时，只能从 packet 提供的 `split_candidates` 里选择 `split_after_offsets`，绝不自己计算 HTML offset。

### 3. Render

```bash
python3 scripts/html_mobile_formatter.py render \
  --manifest BOOK_mobile_work/manifest.json \
  --output "mobile_Book Title.html" \
  --fragment-output "mobile_Book Title.content.html" \
  --publication-manifest "mobile_Book Title.publication.json" \
  --report "mobile_Book Title.qa.json"
```

若数据库中的 fragment 需要固定站点资产路径，追加：

```bash
--fragment-asset-prefix /book-assets/book-slug/
```

默认软目标 300 visible chars；默认 hard gate 420。字符数只是审查信号，不是语义排版规则。

`--allow-unreviewed` 只能预览，不能形成 formal release。

### 4. 第二遍人工/Agent QA

render 后必须检查：

1. QA warnings；
2. 所有 `agent_selected_internal_splits`；
3. 开头、中段、结尾；
4. pivotal standalone 段；
5. 最长段、过短连续段、对白节奏；
6. 章节/Part/Endnotes 等结构；
7. HTML security；
8. 插图/图片引用及资产目录。

发现不自然就修改 `decisions/*.json` 后重新 render。

### 5. Formal audit

```bash
python3 scripts/html_mobile_formatter.py audit \
  --report "mobile_Book Title.qa.json" \
  --require-formal
```

只有 `passed=true` 才算排版完成。

## 手机段落判断标准

- 原 HTML 不同 `<p>` 是硬语义边界：可以拆，但不合并。
- 同一动作、同一解释、紧密指代继续时，倾向 `break_after=false`。
- 新说话者压力、新动作 beat、时间/地点/视角/目标转换时，可 `break_after=true`。
- 重要对白可单独成段；普通对白不要机械“一句一段”。
- 对白 attribution/reaction 与台词紧密时不要拆散。
- 经典散文应保留长呼吸，手机阅读不等于短促碎片化。
- 真正有冲击力的 `“No!”` / `“Hapana!”` 可以单独成段。
- 长句只有在 packet 提供安全候选且两侧都语法/修辞成立时才做内部拆分。

## HTML 安全与结构规则

Formal release 会拒绝：

- unsafe split offset；
- nested/unclosed paragraph structure；
- duplicate `id/xml:id`；
- `script/iframe/object/embed/form/base` 等主动内容；
- `on*` event handler；
- `javascript:` / `vbscript:` / active HTML/SVG data URL；
- meta refresh；
- editable prose 中 misnested/unclosed inline markup；
- visible-text payload 改变；
- Agent 决策覆盖不完整；
- prose paragraph 超过 hard max。

拆分原 `<p>` 时，首段保留原属性；后续 continuation paragraph 会去掉 `id/xml:id/name`，防止重复标识符。

包含 `<br>`、poetry/verse/song/preserve-lines 语义、受保护祖先、nested block structure 的段落默认不进入普通 prose 重排。

## 完整性与换行规则

- `prepare` 以输入文件原始 bytes SHA 锁定 source；
- `render` 前再次验证 source bytes 未变化；
- visible prose 在 browser-like whitespace normalization 后必须 100% 等价；
- output / fragment / publication manifest 的 formal audit 按**文件原始 bytes SHA-256**验证；
- 因此 CRLF HTML 不会再因 Python `read_text()` 自动换行为 LF 而产生假阳性的“文件被修改”错误。

## 发布输出

### Cloudflare

`mobile_<book>.html` 可直接作为 static asset，或进入现有前端 build pipeline。

### Supabase

`mobile_<book>.content.html` 适合存入 Postgres `text` 字段，例如 `books.content_html` 或 `chapters.content_html`。

带图片时，如果 fragment 将在动态 URL 下渲染，应使用 `--fragment-asset-prefix` 映射实际 Cloudflare/R2/Storage 资产地址。未设置映射时，QA 会保留相应 warning，并不会误标为数据库直接发布就绪。

更多见 `references/publishing-html.md`。

## Formal acceptance gates

正式通过必须满足：

- `architecture="agent-first-html"`；
- `script_semantic_autonomy=false`；
- `runtime_dependencies=[]`；
- every packet reviewed；
- every editable unit has explicit Agent `break_after`；
- every chosen split is a supplied safe offset；
- visible-text payload integrity passes；
- HTML paragraph/security checks pass；
- duplicate IDs = 0；
- active/unsafe HTML findings = 0；
- `prose_over_hard_max=0`；
- `audit --require-formal` passes against unchanged source/output/fragment/assets/publication manifest。

Warnings 必须进入第二遍审查，不能当成“可以忽略”。
