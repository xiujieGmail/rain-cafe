import { characterPrompt } from '@/lib/character-prompt';
import { requestSchema, performanceSchema } from '@/lib/protocol';
import { mockReply } from '@/lib/mock';
import { provider, routeError, abortableDelay } from '@/lib/server';

export const runtime = 'nodejs';

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
      // 角色短回复限制输出长度，避免长输出增加延迟与调用费用。
      model: process.env.LLM_MODEL || 'gpt-4o-mini', max_tokens: 512, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: `${characterPrompt}\n枚举值与资源ID必须原样输出英文标识，不得翻译成中文。照片回复的完整示例：{"text":"当然可以，这是海边车站的照片。","emotion":"wistful","story":"photo","events":[{"on":"speech_start","type":"action","name":"show_camera"},{"on":"speech_start","type":"media","name":"travel_photo"}]}。此示例只用于照片话题，其他话题按白名单选择事件。\n当前剧情节点：${input.story}` }, ...input.history, { role: 'user', content: input.text }],
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
