import { z } from 'zod';
import { characterPrompt } from './character-prompt';
import { performanceSchema, type TurnRequest } from './protocol';

const endpoint = z.string().trim().url().refine(value => {
  const url = new URL(value);
  return (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) && !url.username && !url.password && !url.search && !url.hash;
}, '服务地址须为 HTTPS；本机调试允许 localhost HTTP，不能带凭据、查询或片段');
const optionalEndpoint = z.union([z.literal(''), endpoint]);
const field = z.string().trim().max(200);
const key = z.string().trim().max(4096).refine(value => !/[\r\n]/u.test(value), '密钥不能包含换行');
export const customConfigSchema = z.object({
  apiKey: key.refine(value => value.length > 0, '请输入 OPENAI_API_KEY'), baseUrl: endpoint,
  llmModel: field.refine(value => value.length > 0, '请输入 LLM 模型'),
  sttKey: key, sttBaseUrl: optionalEndpoint, sttModel: field.refine(value => value.length > 0, '请输入 STT 模型'),
  ttsKey: key, ttsBaseUrl: optionalEndpoint, ttsModel: field.refine(value => value.length > 0, '请输入 TTS 模型'),
  ttsVoice: field.refine(value => value.length > 0, '请输入 TTS 音色'), jsonMode: z.boolean(),
});
export type CustomConfig = z.infer<typeof customConfigSchema>;
export const emptyCustomConfig: CustomConfig = {
  apiKey: '', baseUrl: 'https://api.openai.com/v1', llmModel: 'gpt-4o-mini',
  sttKey: '', sttBaseUrl: '', sttModel: 'whisper-1',
  ttsKey: '', ttsBaseUrl: '', ttsModel: 'tts-1', ttsVoice: 'nova', jsonMode: true,
};
// 访客主动输入的密钥只留在当前页面内存，不使用任何浏览器持久化或项目后端。
let configuration: CustomConfig | null = null;
export function getCustomConfig() { return configuration; }
export function setCustomConfig(value: CustomConfig | null) { configuration = value ? customConfigSchema.parse(value) : null; }

async function request(config: CustomConfig, service: 'llm' | 'stt' | 'tts', path: string, body: BodyInit, signal: AbortSignal) {
  const base = (service === 'stt' ? config.sttBaseUrl : service === 'tts' ? config.ttsBaseUrl : '') || config.baseUrl;
  const apiKey = (service === 'stt' ? config.sttKey : service === 'tts' ? config.ttsKey : '') || config.apiKey;
  try {
    const response = await fetch(`${base.replace(/\/+$/u, '')}/${path}`, {
      method: 'POST', body, headers: { Authorization: `Bearer ${apiKey}`, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]), credentials: 'omit', cache: 'no-store', redirect: 'error',
    });
    // 不回显上游正文，避免服务把密钥或隐私内容放入错误提示。
    if (!response.ok) throw new Error(`${service.toUpperCase()} 请求失败（HTTP ${response.status}），请检查密钥、模型权限和服务地址。`);
    return response;
  } catch (error) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (error instanceof Error && error.name === 'TimeoutError') throw new Error(`${service.toUpperCase()} 请求超时，请重试或更换服务。`, { cause: error });
    if (error instanceof TypeError) throw new Error(`${service.toUpperCase()} 无法连接，请检查网络与服务端 CORS 跨域授权；在线页面仅支持 HTTPS 服务。`, { cause: error });
    throw error;
  }
}

export async function customRespond(config: CustomConfig, input: TurnRequest, signal: AbortSignal) {
  const started = Date.now();
  const response = await request(config, 'llm', 'chat/completions', JSON.stringify({
    model: config.llmModel, max_tokens: 512, temperature: 0.8,
    ...(config.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    messages: [{ role: 'system', content: `${characterPrompt}\n枚举和资源 ID 必须原样输出英文，不要翻译。当前剧情：${input.story}` }, ...input.history, { role: 'user', content: input.text }],
  }), signal);
  const envelope = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) }).safeParse(await response.json());
  if (!envelope.success) throw new Error('LLM 回复格式不兼容，请使用 chat/completions 接口。');
  const content = envelope.data.choices[0].message.content.trim();
  let raw: unknown;
  try { raw = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/gu, '')); }
  catch { throw new Error('LLM 未返回角色 JSON，请开启 JSON 模式或更换支持结构化输出的模型。'); }
  const valid = performanceSchema.safeParse(raw);
  // 保留可用台词，非法演出指令不进入场景状态。
  const textOnly = z.object({ text: z.string().trim().min(1) }).safeParse(raw);
  if (!valid.success && !textOnly.success) throw new Error('LLM 未返回有效角色台词，请重试。');
  return { ...(valid.success ? valid.data : { text: textOnly.success ? textOnly.data.text.slice(0, 600) : '', emotion: 'calm' as const, story: input.story, events: [] }), turnId: input.turnId, elapsedMs: Date.now() - started };
}

export async function customTranscribe(config: CustomConfig, blob: Blob, signal: AbortSignal) {
  const form = new FormData();
  form.set('file', blob, 'recording.wav'); form.set('model', config.sttModel); form.set('language', 'zh');
  const response = await request(config, 'stt', 'audio/transcriptions', form, signal);
  const parsed = z.object({ text: z.string().trim().min(1) }).safeParse(await response.json());
  if (!parsed.success) throw new Error('STT 未返回有效文字，请回放录音或检查转写模型。');
  return parsed.data.text.slice(0, 500);
}

export async function customSpeech(config: CustomConfig, text: string, signal: AbortSignal) {
  const response = await request(config, 'tts', 'audio/speech', JSON.stringify({ model: config.ttsModel, voice: config.ttsVoice, input: text, response_format: 'mp3' }), signal);
  if (!response.headers.get('content-type')?.startsWith('audio/')) throw new Error('TTS 未返回音频，请检查合成接口与模型。');
  const blob = await response.blob();
  if (!blob.size) throw new Error('TTS 返回了空音频。');
  return blob;
}
