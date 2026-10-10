import 'server-only';

export class ServiceError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export function requireKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ServiceError('尚未配置真实服务密钥，请切换到演示模式。', 503);
  return key;
}
export async function provider(path: string, body: BodyInit, signal: AbortSignal, contentType?: string, service: 'default' | 'stt' = 'default') {
  // 语音识别可独立配置服务；未单独配置时复用通用模型服务的密钥与地址。
  const key = service === 'stt' ? process.env.STT_API_KEY || process.env.OPENAI_API_KEY : requireKey();
  if (!key) throw new ServiceError('语音识别尚未配置，请在 .env.local 设置 STT_API_KEY（或 OPENAI_API_KEY）并重启服务；也可以使用文字输入。', 503);
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (contentType) headers['Content-Type'] = contentType;
  const baseUrl = (service === 'stt' ? process.env.STT_BASE_URL : undefined) || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${path}`, {
    method: 'POST', headers, body,
    // 同时响应客户端取消和服务端超时，避免上游请求长期占用资源。
    signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
  });
  if (!response.ok) throw new ServiceError(response.status === 429 ? '服务暂时繁忙，请稍后重试。' : '外部服务调用失败，请重试或切换到演示模式。');
  return response;
}
export function routeError(error: unknown) {
  if (error instanceof ServiceError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return Response.json({ error: '请求超时或已取消，请重试。' }, { status: 504 });
  // 日志只记录错误类型，不输出转写内容、密钥或上游响应正文。
  console.error('[provider] failed', error instanceof Error ? error.name : 'unknown');
  return Response.json({ error: '服务暂时无法完成请求，请重试。' }, { status: 502 });
}
export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    // 故障演示的延迟也可被取消，旧轮不会在等待结束后继续回复。
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
