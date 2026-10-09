# Soma 数据通道实施进度与验证证据

日期：2026-10-09
分支：`codex/soma-incremental-deploy-2026-10-09`
母线：`main` / `78d1f87d7b14ab779d89638bf4be58e2c5fbc575`
状态：**开发与离线验证阶段**；尚未开启线上 DATA 或切换生产 cron。

## 保护范围

- **绝不修改生产环境**：没有调用正式的 Wrangler deploy，没有改变生产 Cron/launchd，没有向生产 Supabase 写入。
- 保留现有 `cf:build`、`cf:deploy` 与 `release:books` 的原全量语义。
- 新路径显式选择 `--target preview|production`；生产数据通道另要求有效三轮预览证明和明确批准。
- Git 不包含部署缓存、成功游标、密钥或生成的读者 HTML。

## 已实施

- 静态 SEO 所有权清单、完整性校验、符号链接/路径逃逸拒绝。
- 候选目录镜像同步：新增、更新、删除、保留保护区，dry-run、差分报告与逐哈希验证、批量撤书门禁。
- 构建指纹：源码、静态程序资源、环境、Worker、Vite、候选 manifest、已成功发布快照分别比对。
- SEO 生成器：不再改写 Git 跟踪的 `index.html`；数据生成入 `catalog/home-seo.json`；补强零章拒绝及缓存文件丢失修复；可指定固定构建时间 `SOMA_BUILD_TIMESTAMP`。
- 首页统一补丁：Vite 编译完成后补丁已编译 HTML；DATA 将复用相同代码，不会替换 Vite bundle 引用。
- 候选与成功状态分离；同环境互斥锁、原子状态提交、远端状态不明时的恢复标记。
- 隔离预览 Worker 生成逻辑，独立自引用绑定、测试 Supabase 检查、`X-Robots-Tag` noindex。
- 公共部署入口、`release-soma-books.mjs --data-only` 显式接入；未批准时在数据库上传前拒绝。
- 生产通道强制预览证明（三种不同实际部署的 added/updated/withdrawn）；放行门禁升级至 schema v2：要求 Cloudflare deployment ID 唯一、同一份源码指纹、七天内完成、双语新增/实质章节更新/完整撤书的真实证据；源码变更使原证明失效。

## 已验证（本机 Mac mini 隔离克隆）

- Node v24.13.1；Next.js v16.3.0；OpenNext/Cloudflare v1.20.2；Vite v6.4.3；Wrangler v4.118.0。
- `npm run build:vite`：成功；书页 247、静态章节 6645。
- `npm run cf:build`：已两次成功；首轮 7213 文件/143640308 字节，分支最终复验为 7217 文件/143663569 字节，均低于项目限额。
- `wrangler deploy --dry-run --no-autoconfig`：成功退出，**未部署**；首次 7966 个读入条目，2026-10-09 本轮重建后 7974 个读入条目（其中 7217 个实际文件）；Wrangler 的读入条目包含目录，不等于 Cloudflare 静态文件数量。
- `npm run test:book-release`：27 passed。
- `npm run test:incremental-deploy`：**19/19 passed**；离线门禁 + 合成差分测试；固定时间、双语关联、章节编辑、整书撤回的 FULL/INCREMENTAL 静态 SEO 结果逐文件哈希一致；远端旧章节、撤回后残留页面被拒；生产放行拒绝重复 Cloudflare deployment ID、旧代码指纹、超期证明、只改书元数据但章节未改的伪更新。
- `npm run lint`：TypeScript Vite typecheck 成功。
- 本轮复验：从既有 `wrangler.jsonc` 读取公开 URL/anon key 作为**进程级临时构建变量**，`cf:build` 成功；247 本书、6645 章、7217 个静态文件、143663569 字节；无 Supabase 公开构建变量时 `cf:build` 预期 fail-closed，代码与密钥文件均无改动。
- 注意：用生产公开只读配置生成 SEO 会使本地 `public/` 跟踪文件与 Git 快照不同（241→247 本书）。该构建产物不得并入本实施分支提交；本次提交仅包含开发代码、测试、部署文档。
- 显式 fail-closed CLI 探针：缺预览环境时 `PREVIEW_ENV_MISSING`（退出码 1）；未取得生产批准时 `PRODUCTION_APPROVAL_REQUIRED`（退出码 1），均未调用远端部署。
- 不包含真实三轮 Cloudflare 预览部署的结论。

## 尚待真实环境完成

1. 取得与生产 Supabase 不同的独立测试项目及受控测试数据。
2. Mac mini 上 `wrangler whoami` 实测返回 **You are not authenticated**；在受信任部署环境配置 Cloudflare 授权后才能真实部署预览 Worker。
3. 配置 `SOMA_PREVIEW_SUPABASE_URL`、`SOMA_PREVIEW_SUPABASE_ANON_KEY`、`SOMA_PREVIEW_BASE_URL`（后者必须是独立 workers.dev 域名）；预览 Worker 账户应可用且不能映射生产自引用服务。三轮预览必须使用**同一代码指纹**，三次真实 Cloudflare deployment ID 互不重复，且放行时验证记录不得超过七天。
4. 分别执行新增双语书、更新章节、撤回旧书的**三次不同预览部署**，每轮收集真实 deployment ID、远端 HTML/headers、完整缓存/版本证据。
5. 找到生产机实际 `deploy_soma_site.py`/cron/launchd 入口，审查配置，**不能依据 Mac mini 无匹配就认为生产无 cron**。
6. 全面验收数据库审计、线上缓存、首页、目录、SEO/AI 索引、旧路径 404、API 和管理员访问；失败后演练恢复/回滚。
7. 预览三轮证明全部完成后，再在明确生产放行下进行 3 次低风险人工灰度；最后才允许改生产 cron。

## 运行说明

```bash
npm run test:book-release
npm run test:incremental-deploy
npm run lint
npm run cf:build
node scripts/code-hash.mjs verify --target preview
node scripts/deploy-soma-site.mjs --target preview --data-only --dry-run
# 独立测试环境具备且 dry-run 合格之后：
node scripts/deploy-soma-site.mjs --target preview --data-only --scenario added
node scripts/deploy-soma-site.mjs --target preview --data-only --scenario updated
node scripts/deploy-soma-site.mjs --target preview --data-only --scenario withdrawn
```

带 `--data-only` 是“请求 DATA，门禁失败自动 FULL”，实际模式及 fallback 原因写入审计。真实部署后的成功状态与生成 manifest 分开；候选失败不推进成功游标。