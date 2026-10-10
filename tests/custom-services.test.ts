import { afterEach, describe, expect, it, vi } from 'vitest';
import { customConfigSchema, customRespond, customSpeech, customTranscribe, emptyCustomConfig, getCustomConfig, setCustomConfig } from '../src/lib/custom-services';
import type { TurnRequest } from '../src/lib/protocol';

const config = { ...emptyCustomConfig, apiKey: 'visitor-test-key', baseUrl: 'https://text.example/v1/', sttBaseUrl: 'https://recognition.example/api/v1', sttKey: 'recognition-test-key', ttsBaseUrl: 'https://voice.example/v1', ttsKey: 'voice-test-key' };
const input: TurnRequest = { text: '看看照片', mode: 'live', turnId: 3, story: 'arrival', history: [{ role: 'user', content: '你好' }, { role: 'assistant', content: '你好呀' }], fault: 'none' };
afterEach(() => { vi.unstubAllGlobals(); setCustomConfig(null); });
describe('visitor-provided OpenAI-compatible services', () => {
  it('routes text, STT and TTS to independent providers and preserves context and cancellation', async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(init.credentials).toBe('omit'); expect(init.redirect).toBe('error');
      if (url.includes('chat/completions')) {
        expect(headers.Authorization).toBe('Bearer visitor-test-key');
        const body = JSON.parse(init.body as string);
        expect(body.model).toBe(config.llmModel); expect(body.messages.slice(1)).toEqual([...input.history, { role: 'user', content: input.text }]);
        return Response.json({ choices: [{ message: { content: JSON.stringify({ text: '给你看看', emotion: 'warm', story: 'photo', events: [] }) } }] });
      }
      if (url.includes('transcriptions')) {
        expect(headers.Authorization).toBe('Bearer recognition-test-key'); expect(headers['Content-Type']).toBeUndefined();
        const form = init.body as FormData; expect(form.get('model')).toBe(config.sttModel); expect((form.get('file') as File).type).toBe('audio/wav');
        return Response.json({ text: ' 看看照片 ' });
      }
      expect(headers.Authorization).toBe('Bearer voice-test-key'); expect(JSON.parse(init.body as string)).toMatchObject({ model: config.ttsModel, voice: config.ttsVoice, input: '给你看看' });
      return new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } });
    });
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    expect((await customRespond(config, input, controller.signal)).turnId).toBe(3);
    expect(await customTranscribe(config, new Blob(['wav'], { type: 'audio/wav' }), controller.signal)).toBe('看看照片');
    expect((await customSpeech(config, '给你看看', controller.signal)).size).toBeGreaterThan(0);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['https://text.example/v1/chat/completions', 'https://recognition.example/api/v1/audio/transcriptions', 'https://voice.example/v1/audio/speech']);
    controller.abort();
    expect(fetcher.mock.calls.every(([, init]) => init.signal?.aborted)).toBe(true);
  });
  it('falls back to common credentials, supports disabling JSON mode and removes invalid events', async () => {
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(init.body as string).response_format).toBeUndefined();
      return Response.json({ choices: [{ message: { content: '```json\n{"text":"照片","events":[{"name":"https://evil.example"}]}\n```' } }] });
    });
    vi.stubGlobal('fetch', fetcher);
    const reply = await customRespond({ ...emptyCustomConfig, apiKey: 'test-key', jsonMode: false }, input, new AbortController().signal);
    expect(reply.events).toEqual([]); expect(reply.text).toBe('照片'); expect(reply.emotion).toBe('calm');
  });
  it('rejects unsafe endpoint shapes and never stores configuration in browser storage', () => {
    for (const baseUrl of ['http://text.example/v1', 'https://user:pass@text.example/v1', 'https://text.example/v1?key=secret', 'https://text.example/v1#key']) expect(customConfigSchema.safeParse({ ...config, baseUrl }).success).toBe(false);
    expect(customConfigSchema.safeParse({ ...config, baseUrl: 'http://localhost:3012/v1' }).success).toBe(true);
    const setItem = vi.fn(); vi.stubGlobal('localStorage', { setItem }); vi.stubGlobal('sessionStorage', { setItem });
    setCustomConfig(config); expect(getCustomConfig()?.apiKey).toBe('visitor-test-key'); expect(setItem).not.toHaveBeenCalled();
    setCustomConfig(null); expect(getCustomConfig()).toBeNull();
  });
  it('does not expose provider response content on auth failure and explains network/CORS errors', async () => {
    vi.stubGlobal('fetch', async () => new Response('private-key-and-response', { status: 401 }));
    await expect(customRespond(config, input, new AbortController().signal)).rejects.toThrow('HTTP 401');
    await expect(customRespond(config, input, new AbortController().signal)).rejects.not.toThrow('private-key');
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    await expect(customRespond(config, input, new AbortController().signal)).rejects.toThrow('CORS');
  });
  it('validates upstream text and audio before passing them to the interaction engine', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ text: '' }));
    await expect(customTranscribe(config, new Blob(['wav']), new AbortController().signal)).rejects.toThrow('有效文字');
    await expect(customSpeech(config, '你好', new AbortController().signal)).rejects.toThrow('未返回音频');
    vi.stubGlobal('fetch', async () => Response.json({ choices: [] }));
    await expect(customRespond(config, input, new AbortController().signal)).rejects.toThrow('格式不兼容');
  });
});
