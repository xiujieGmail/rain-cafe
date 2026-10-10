import { requestSchema, performanceSchema } from '@/lib/protocol';
import { mockReply } from '@/lib/mock';
import { provider, routeError, abortableDelay } from '@/lib/server';

export const runtime = 'nodejs';
const prompt = `你是原创成年角色 Mira，26岁旅行摄影师，琥珀雨衣、银色星星发夹。暴雨刚停，你在即将打烊的咖啡馆等一位旧友。用温柔自然中文回应，最多120字，不要输出舞台提示或提及AI。记住当前对话，逐步信任用户，允许自由交流，不强迫固定剧情。只输出JSON对象：{"text":"台词","emotion":"calm|guarded|warm|wistful","story":"arrival|waiting|trust|photo|departure","events":[]}。events最多4项，每项{"on":"speech_start|speech_end","type":"action|scene|media","name":"资源ID"}。action允许look_window、show_camera，scene允许warm_light、rain_clears，media仅travel_photo。用户谈照片可show_camera与travel_photo，陪伴可warm_light，出去走走可rain_clears；所有事件必须有关当前对话。情绪与动作必须用允许值。图片是预制海边车站照片，不要声称实时生成图片。`;

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: '输入格式不正确，文字最多 500 字。' }, { status: 400 });
    const input = parsed.data;
    // 无密钥演示使用剧情规则，延迟和故障均明确模拟，并遵循请求取消信号。
    if (input.mode === 'mock') {
      await abortableDelay(input.fault === 'slow' ? 7000 : input.fault === 'timeout' ? 1500 : 700, request.signal);
      if (input.fault === 'timeout') return Response.json({ error: '演示：模型请求超时。可以重试，或继续下一轮。' }, { status: 504 });
      return Response.json({ ...mockReply(input.text, input.story), turnId: input.turnId, elapsedMs: Date.now() - started });
    }
    // 通过服务端调用模型，携带历史与剧情节点，要求返回结构化角色演出。
    const upstream = await provider('chat/completions', JSON.stringify({
      model: process.env.LLM_MODEL || 'gpt-4o-mini', response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: `${prompt}\n当前剧情节点：${input.story}` }, ...input.history, { role: 'user', content: input.text }],
      temperature: 0.8,
    }), request.signal, 'application/json');
    const data = await upstream.json();
    const raw = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    const valid = performanceSchema.safeParse(raw);
    if (valid.success) return Response.json({ ...valid.data, turnId: input.turnId, elapsedMs: Date.now() - started });
    // 演出指令不合法但台词可用时保留台词，移除事件，避免可选动画阻塞对话。
    if (typeof raw.text === 'string' && raw.text.trim()) return Response.json({ text: raw.text.slice(0, 600), emotion: 'calm', story: input.story, events: [], turnId: input.turnId, elapsedMs: Date.now() - started });
    return Response.json({ error: '角色回复格式异常，请重试。' }, { status: 502 });
  } catch (error) { return routeError(error); }
}
