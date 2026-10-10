import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// 独立本地上游只验证录音转发和对话链路，不作为真实语音识别质量的证据。
let upstreamFailure = false;
let forwarded;
const upstream = createServer(async (req, res) => {
  try {
    assert.equal(req.url, '/v1/audio/transcriptions');
    assert.equal(req.headers.authorization, 'Bearer voice-smoke-test-key');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = new Request('http://localhost/transcribe', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: Buffer.concat(chunks) });
    const form = await request.formData();
    forwarded = { file: await form.get('file').text(), type: form.get('file').type, model: form.get('model'), language: form.get('language') };
    res.writeHead(upstreamFailure ? 429 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(upstreamFailure ? { error: 'busy' } : { text: '看看你的照片？' }));
  } catch {
    res.writeHead(500); res.end('test upstream assertion failed');
  }
});
await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
const reserve = createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, OPENAI_API_KEY: '', STT_API_KEY: 'voice-smoke-test-key', STT_BASE_URL: `http://127.0.0.1:${upstream.address().port}/v1`, STT_MODEL: 'test-whisper' },
  stdio: 'ignore',
});
async function upload() {
  const form = new FormData();
  form.set('audio', new Blob(['voice-smoke-audio-bytes'], { type: 'audio/mp4' }), 'recording.mp4');
  return fetch(`${base}/api/transcribe`, { method: 'POST', body: form });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(`${base}/api/config`)).ok; } catch {}
    if (ready) break;
    if (child.exitCode !== null) throw new Error('Test app stopped before becoming ready');
    await delay(100);
  }
  assert.ok(ready, 'Test app did not become ready');
  const result = await upload();
  assert.equal(result.status, 200);
  const { text } = await result.json();
  assert.equal(text, '看看你的照片？');
  assert.deepEqual(forwarded, { file: 'voice-smoke-audio-bytes', type: 'audio/mp4', model: 'test-whisper', language: 'zh' });
  const reply = await fetch(`${base}/api/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, mode: 'mock', turnId: 1, story: 'arrival', history: [], fault: 'none' }) }).then(r => r.json());
  assert.equal(reply.story, 'photo');
  assert.ok(reply.events.some(event => event.name === 'travel_photo'));
  assert.equal((await fetch(`${base}/audio/${reply.audioId}.wav`)).status, 200);
  upstreamFailure = true;
  const failure = await upload();
  assert.equal(failure.status, 502);
  assert.match((await failure.json()).error, /繁忙/);
  console.log('Voice HTTP smoke passed: audio forwarding, independent STT config, transcript → mock dialogue → WAV, upstream failure. Local test service only; no actual speech recognition.');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
  upstream.closeAllConnections();
  await new Promise(resolve => upstream.close(resolve));
}
