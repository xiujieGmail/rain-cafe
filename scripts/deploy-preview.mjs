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
  run('git', ['remote', 'add', 'origin', 'https://github.com/xiujieGmail/rain-cafe.git'], stage);
  const remote = spawnSync('git', ['ls-remote', 'origin', 'refs/heads/gh-pages'], { cwd: stage, encoding: 'utf8' });
  if (remote.status !== 0) throw new Error('无法读取远程发布分支');
  if (remote.stdout.trim()) {
    // 继承上一版产物的历史，使用普通推送，避免覆盖并发发布。
    run('git', ['fetch', 'origin', 'gh-pages'], stage);
    run('git', ['update-ref', 'refs/heads/gh-pages', 'FETCH_HEAD'], stage);
  }
  run('git', ['add', '.'], stage);
  run('git', ['-c', 'user.name=Rain Cafe deploy', '-c', 'user.email=deploy@users.noreply.github.com', 'commit', '-m', 'Publish Rain Cafe static preview'], stage);
  run('git', ['push', 'origin', 'gh-pages'], stage);
} finally {
  await rm(stage, { recursive: true, force: true });
}
