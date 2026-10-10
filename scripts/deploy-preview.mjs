import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} 执行失败`);
};
run('npm', ['run', 'check']);
run('npm', ['run', 'build:preview']);
const stage = await mkdtemp(join(tmpdir(), 'rain-cafe-pages-'));
try {
  // 发布目录只包含静态产物，不把后端代码和服务配置放到公开站点。
  await cp(resolve(root, '.preview-build/out'), stage, { recursive: true });
  run('git', ['init', '-b', 'gh-pages'], stage);
  run('git', ['add', '.'], stage);
  run('git', ['-c', 'user.name=Rain Cafe deploy', '-c', 'user.email=deploy@users.noreply.github.com', 'commit', '-m', 'Publish Rain Cafe static preview'], stage);
  run('git', ['remote', 'add', 'origin', 'https://github.com/xiujieGmail/rain-cafe.git'], stage);
  // gh-pages 是独立的构建产物分支；只替换它，不改写 main 的源码历史。
  run('git', ['push', '--force', 'origin', 'gh-pages'], stage);
} finally {
  await rm(stage, { recursive: true, force: true });
}
