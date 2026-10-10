import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
// 可在 macOS 重新生成语音；运行时直接播放项目内 WAV，无需调用系统朗读工具。
await mkdir('public/audio', { recursive: true });
await mkdir('tmp/audio', { recursive: true });
const source = await readFile('src/lib/mock.ts', 'utf8');
const lines = [...source.matchAll(/^ {2}(\w+): '([^']+)',/gm)];
for (const [, name, text] of lines) {
  execFileSync('/usr/bin/say', ['-v', 'Tingting', '-r', '175', '-o', `tmp/audio/${name}.aiff`, text]);
  execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@22050', `tmp/audio/${name}.aiff`, `public/audio/${name}.wav`]);
  console.log(`Generated ${name}.wav`);
}
