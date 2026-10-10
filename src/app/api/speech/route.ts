import { z } from 'zod';
import { provider, routeError } from '@/lib/server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const parsed = z.object({ text: z.string().min(1).max(600) }).safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: '语音请求格式不正确。' }, { status: 400 });
    // 合成沿用本轮取消信号，音频以二进制返回且不缓存用户对话内容。
    const upstream = await provider('audio/speech', JSON.stringify({ model: process.env.TTS_MODEL || 'tts-1', voice: process.env.TTS_VOICE || 'nova', input: parsed.data.text, response_format: 'mp3' }), request.signal, 'application/json', 'tts');
    return new Response(await upstream.arrayBuffer(), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  } catch (error) { return routeError(error); }
}
