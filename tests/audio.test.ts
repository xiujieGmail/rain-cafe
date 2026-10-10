import { afterEach, describe, expect, it, vi } from 'vitest';
import { speak } from '../src/lib/browser-services';

class FakeAudio {
  static last: FakeAudio;
  onplaying: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn();
  removeAttribute = vi.fn();
  load = vi.fn();
  constructor(public src: string) { FakeAudio.last = this; }
  async play() { this.onplaying?.(); }
}
const reply = { turnId: 1, text: '你好', emotion: 'calm' as const, story: 'arrival' as const, events: [], audioId: 'greeting', elapsedMs: 1 };
afterEach(() => { vi.unstubAllGlobals(); });
describe('browser audio lifetime', () => {
  it('immediately pauses and detaches the audio on interruption', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const controller = new AbortController();
    const start = vi.fn();
    const playback = speak(reply, 'mock', 'none', controller.signal, start);
    expect(start).toHaveBeenCalledOnce();
    const oldEnded = FakeAudio.last.onended;
    controller.abort();
    await expect(playback).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeAudio.last.pause).toHaveBeenCalledOnce();
    expect(FakeAudio.last.removeAttribute).toHaveBeenCalledWith('src');
    expect(FakeAudio.last.onended).toBe(null);
    // A previously queued native callback must not settle or restart playback twice.
    oldEnded?.();
    expect(FakeAudio.last.pause).toHaveBeenCalledOnce();
  });
  it('cleans playback resources when audio loading fails', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const playback = speak(reply, 'mock', 'none', new AbortController().signal, vi.fn());
    FakeAudio.last.onerror?.();
    await expect(playback).rejects.toThrow('语音加载失败');
    expect(FakeAudio.last.pause).toHaveBeenCalledOnce();
    expect(FakeAudio.last.onplaying).toBe(null);
  });
});
