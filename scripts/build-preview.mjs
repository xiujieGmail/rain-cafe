import { cp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = process.cwd();
// 在独立目录导出静态演示，保留主项目的所有后端路由和本地配置。
const stage = resolve(root, '.preview-build');
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const name of ['src', 'public', 'package.json', 'tsconfig.json', 'next-env.d.ts', 'postcss.config.mjs']) {
  await cp(resolve(root, name), resolve(stage, name), { recursive: true, filter: source => !source.startsWith(resolve(root, 'src/app/api')) });
}
await symlink(resolve(root, 'node_modules'), resolve(stage, 'node_modules'), 'dir').catch(error => { if (error.code !== 'EEXIST') throw error; });
const basePath = '/rain-cafe';
await writeFile(resolve(stage, 'next.config.mjs'), `export default ${JSON.stringify({ output: 'export', basePath, trailingSlash: true, poweredByHeader: false, env: { NEXT_PUBLIC_STATIC_PREVIEW: 'true', NEXT_PUBLIC_BASE_PATH: basePath }, turbopack: { root } })};
`);
const result = spawnSync(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'build'], { cwd: stage, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
await writeFile(resolve(stage, 'out/.nojekyll'), '');
