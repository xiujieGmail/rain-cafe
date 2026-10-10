import { provider, routeError } from '@/lib/server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    // 在调用外部服务前检查文件大小与格式，录音仅在请求内转发，不写入磁盘。
    const file = form.get('audio');
    if (!(file instanceof File) || file.size === 0 || file.size > 8 * 1024 * 1024) return Response.json({ error: '录音为空或超过 8MB，请重新录制。' }, { status: 400 });
    if (!['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'].some(type => file.type.startsWith(type))) return Response.json({ error: '录音格式不受支持，请使用文字输入。' }, { status: 400 });
    const upstreamForm = new FormData();
    upstreamForm.set('file', file);
    upstreamForm.set('model', process.env.STT_MODEL || 'whisper-1');
    upstreamForm.set('language', 'zh');
    // 使用独立 STT 配置转发实际录音，取消信号贯穿上传和识别过程。
    const upstream = await provider('audio/transcriptions', upstreamForm, request.signal, undefined, 'stt');
    const result = await upstream.json();
    if (typeof result.text !== 'string' || !result.text.trim()) return Response.json({ error: '没有听清，请再说一次。' }, { status: 422 });
    return Response.json({ text: result.text.trim().slice(0, 500) });
  } catch (error) { return routeError(error); }
}
