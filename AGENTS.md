<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 项目工程规范（必须遵守）

修改或审查本仓库时，先阅读并应用 [.agents/skills/rain-cafe-engineering/SKILL.md](.agents/skills/rain-cafe-engineering/SKILL.md)。所有后续代码和文档修改遵守该 skill；关键逻辑采用中文 `// xxx` 注释，其他语言使用合法注释语法。

提交前运行 `npm run check`、`npm run build` 与相关 smoke。`.env.local` 仅用于本地，禁止提交或输出密钥。人工验收与自动检查分别记录，未经验证的能力不标记通过。
