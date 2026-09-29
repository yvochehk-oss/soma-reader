<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:ops-rules -->
# Soma 部署与运维规则(2026-08-15 立)

## 1. 发布真伪核验:必须走 wrangler / book-import API

核对站点实际发布状态时,**绝不要**只读本地 `facebook_publishing.db` / `token.json` 就下结论。本地状态是写过的"我以为发了",不是"发了"。

正确做法(按优先级):

1. **首选 `wrangler deployments list --name soma-reader` + `wrangler tail`** — 直连 Cloudflare,看真实部署记录。
2. 次选 `curl https://somanovel.uk/api/internal/book-import?slug=<slug>` — 站点后端的权威审计端点,返回该书的 published/chapter 真实状态。
3. 兜底 `curl https://somanovel.uk/sitemap-books-{en,sw}.xml` — 站点 sitemap 只含 published 行,缺一个 slug 就是漏发。

## 2. Python 工具一律用 uv

所有 Python 脚本(读写 sqlite、调 Supabase REST、解析 sitemap、扫 release 状态等)必须:

- `uv run script.py`,**不要**直接 `python`/`python3`(系统 Python 不在,会被沙箱拒绝)。
- 依赖通过 `[project]` in `pyproject.toml` 或 `uv pip install --system <pkg>` 装。
- 一次性脚本可 `uv run --with requests --with beautifulsoup4 python -c "..."`。
- **CLI 工具用 `uvx`**(等同旧版 `pipx run`/ `python -m`)— 例:本机没有 `mflux-generate-flux2`,首次跑 `uvx --from mflux mflux-generate-flux2 ...` 自动拉 venv 缓存,后续快。
- 已废的旧 `omlx-venv/bin/mflux-generate-flux2` 别再用,那是空壳 venv;真正能调通的是 `uvx --from mflux mflux-generate-flux2 --model /Users/yvoche/omlx-models/flux2-klein-4b ...`。

## 3. 出网 + Shell 沙箱备忘

- 出网请求(curl / WebFetch 访问 somanovel.uk / supabase / npm)若被拒,加 `required_permissions: ["full_network"]`。
- `Shell` 工具若后台 `&` 启进程,需 `kill %1`,否则终端卡死超时。
- `nice(5) failed: operation not permitted` 在沙箱内无害,可忽略,不要因此停手。

## 4. 封面生成硬性约束：必须使用 AI 图像模型

所有书籍封面的生成与制作，**绝对禁止**仅使用纯色遮罩、基础几何或无 AI 参与的纯文本排版。**必须显式使用 AI 图像生成模型**渲染纯摄影/艺术底稿：
- **优先本地模型**：使用 `uvx --from mflux mflux-generate-flux2 --model /Users/yvoche/omlx-models/flux2-klein-4b --steps 4 --width 768 --height 1024 --prompt "<novel_cinematic_photo_prompt>"` 极速生成 3:4 电影级底图。
- **云端模型/Tool 兜底**：若本地模型不可用，必须使用 `generate_image` 工具调用云端 AI 图像模型生成底图。
- **排版合规**：在 AI 模型生成的艺术底图上使用 Pillow 叠加自适应安全边距的双语标题与作者名，生成 `cover_sw.jpg`、`cover_en.jpg` 与 `cover.jpg`。
<!-- END:ops-rules -->
