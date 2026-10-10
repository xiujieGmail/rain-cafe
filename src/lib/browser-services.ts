import type { Fault, TurnReply, TurnRequest } from './protocol';
import { mockReply } from './mock';
import { assetPath, staticPreview } from './preview';

async function checked(response: Response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || '网络请求失败，请重试。');
  }
  return response;
}
export async function respond(input: TurnRequest, signal: AbortSignal) {
  // GitHub Pages 没有后端，演示延迟仍监听取消，避免旧回复覆盖新轮。
  if (staticPreview) {
    if (input.mode !== 'mock') throw new Error('静态预览仅提供演示对话。');
    const started = Date.now();
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, input.fault === 'slow' ? 7000 : input.fault === 'timeout' ? 1500 : 700);
      signal.addEventListener('abort', abort, { once: true });
    });
    if (input.fault === 'timeout') throw new Error('演示：模型请求超时。可以重试，或继续下一轮。');
    return { ...mockReply(input.text, input.story), turnId: input.turnId, elapsedMs: Date.now() - started };
  }
  const response = await checked(await fetch('/api/respond', { method: 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) }));
  return response.json();
}
export async function transcribe(blob: Blob, signal: AbortSignal) {
  if (staticPreview) throw new Error('GitHub 静态预览不提供语音识别后端。请使用文字或模拟语音输入，实际录音请在本地配置服务后体验。');
  const form = new FormData();
  // 根据浏览器实际录音格式设置扩展名，不把 Safari 的 MP4 当成 WebM 上传。
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  form.set('audio', blob, `recording.${ext}`);
  const response = await checked(await fetch('/api/transcribe', { method: 'POST', body: form, signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) }));
  const data = await response.json();
  if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('没有听清，请再说一次。');
  return data.text as string;
}

export async function speak(reply: TurnReply, mode: 'mock' | 'live', fault: Fault, signal: AbortSignal, onStart: () => void) {
  if (fault === 'audio' && mode === 'mock') throw new Error('Simulated audio failure');
  let url: string;
  let objectUrl = false;
  if (mode === 'mock') {
    // 演示回复使用随项目交付的语音文件，不依赖在线语音合成服务。
    url = assetPath(`/audio/${reply.audioId || 'greeting'}.wav`);
  } else {
    const response = await checked(await fetch('/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: reply.text }), signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) }));
    const blob = await response.blob();
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    url = URL.createObjectURL(blob);
    objectUrl = true;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      const audio = new Audio(url);
      let finished = false;
      let loadingTimer: ReturnType<typeof setTimeout> | undefined;
      let playbackTimer: ReturnType<typeof setTimeout> | undefined;
      // 播放结束、失败和取消共用幂等清理，立即停声并解除所有旧回调。
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        clearTimeout(loadingTimer);
        clearTimeout(playbackTimer);
        signal.removeEventListener('abort', abort);
        audio.onplaying = null; audio.onended = null; audio.onerror = null;
        audio.pause(); audio.removeAttribute('src'); audio.load();
        if (error) reject(error); else resolve();
      };
      const abort = () => finish(new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', abort, { once: true });
      audio.onplaying = () => {
        clearTimeout(loadingTimer);
        if (!signal.aborted && !finished) {
          // 以 playing 事件同步字幕，避免下载音频时就显示角色正在说话。
          onStart();
          if (!playbackTimer) playbackTimer = setTimeout(() => finish(new Error('语音播放超时')), 90000);
        }
      };
      audio.onended = () => finish();
      audio.onerror = () => finish(new Error('语音加载失败'));
      loadingTimer = setTimeout(() => finish(new Error('语音加载超时')), 12000);
      audio.play().catch(error => finish(error instanceof Error ? error : new Error('音频无法播放')));
    });
  // 合成音频的临时地址无论成功、失败还是取消都必须释放。
  } finally { if (objectUrl) URL.revokeObjectURL(url); }
}

export type Recording = { stop: () => void; cancel: () => void };
export async function record(signal: AbortSignal, onComplete: (blob: Blob) => void, onFailure: (error: Error) => void): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('当前浏览器无法录音，请在 HTTPS 或 localhost 下使用，或改用文字。');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  // 用户可能在授权弹窗期间开始了新轮；迟到的麦克风授权也要释放设备。
  if (signal.aborted) { stream.getTracks().forEach(track => track.stop()); throw new DOMException('Aborted', 'AbortError'); }
  // 优先使用浏览器支持的编码，兼容 Chromium、Safari 和 Ogg 录音。
  const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
  let recorder: MediaRecorder;
  try { recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); }
  catch { stream.getTracks().forEach(track => track.stop()); throw new Error('当前录音设备无法初始化，请使用文字。'); }
  const chunks: Blob[] = [];
  let canceled = false;
  let cleaned = false;
  let maxTimer: ReturnType<typeof setTimeout>;
  const stop = () => { if (recorder.state !== 'inactive') recorder.stop(); };
  // 正常结束会提交录音，取消只停止设备，不能把旧录音交给识别服务。
  const cancel = () => { canceled = true; stop(); };
  const cleanup = () => { if (cleaned) return; cleaned = true; clearTimeout(maxTimer); signal.removeEventListener('abort', cancel); stream.getTracks().forEach(track => track.stop()); };
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  // 先释放麦克风和定时器，再提交完整录音；取消后的片段直接丢弃。
  recorder.onstop = () => {
    cleanup();
    if (!canceled && !signal.aborted) onComplete(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
  };
  recorder.onerror = () => { canceled = true; stop(); cleanup(); if (!signal.aborted) onFailure(new Error('录音中断，请重新录制或使用文字。')); };
  signal.addEventListener('abort', cancel, { once: true });
  try { recorder.start(); }
  catch { cleanup(); throw new Error('无法开始录音，请重新授权或使用文字。'); }
  maxTimer = setTimeout(stop, 45000);
  return { stop, cancel };
}
