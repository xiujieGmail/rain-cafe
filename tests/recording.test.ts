import { afterEach, describe, expect, it, vi } from 'vitest';
import { record } from '../src/lib/browser-services';

class FakeRecorder {
  static last: FakeRecorder;
  static isTypeSupported(type: string) { return type === 'audio/mp4'; }
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/mp4';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: unknown, public options?: { mimeType: string }) { FakeRecorder.last = this; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['test']) }); this.onstop?.(); }
}
function device(getStream?: () => Promise<unknown>) {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }], getAudioTracks: () => [{ stop, label: 'Test microphone' }] };
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: getStream || (async () => stream) } });
  return { stream, stop };
}
afterEach(() => { vi.unstubAllGlobals(); });
describe('microphone cancellation and cleanup', () => {
  it('uses the selected input device and reports the actual microphone name', async () => {
    const { stream } = device();
    const getUserMedia = vi.fn(async () => stream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const onDevice = vi.fn();
    const recording = await record(new AbortController().signal, vi.fn(), vi.fn(), { deviceId: 'built-in-mic', onDevice });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: expect.objectContaining({ deviceId: { exact: 'built-in-mic' } }) });
    expect(onDevice).toHaveBeenCalledWith('Test microphone');
    recording.cancel();
  });
  it('selects a supported Safari format and stops microphone tracks after submission', async () => {
    const { stop } = device();
    const complete = vi.fn();
    const recording = await record(new AbortController().signal, complete, vi.fn());
    expect(FakeRecorder.last.options?.mimeType).toBe('audio/mp4');
    recording.stop();
    expect(stop).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(complete.mock.calls[0][0].type).toBe('audio/mp4');
  });
  it('does not submit canceled audio and releases the microphone', async () => {
    const { stop } = device();
    const complete = vi.fn();
    const controller = new AbortController();
    await record(controller.signal, complete, vi.fn());
    controller.abort();
    expect(stop).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
  });
  it('releases a late permission grant after its turn is already canceled', async () => {
    let resolve!: (value: unknown) => void;
    const late = new Promise(resolvePromise => { resolve = resolvePromise; });
    const { stream, stop } = device(() => late);
    const controller = new AbortController();
    const complete = vi.fn();
    const pending = record(controller.signal, complete, vi.fn());
    controller.abort();
    resolve(stream);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(stop).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
  });
  it('surfaces a recording failure without committing partial audio', async () => {
    const { stop } = device();
    const complete = vi.fn(), failure = vi.fn();
    await record(new AbortController().signal, complete, failure);
    FakeRecorder.last.onerror?.();
    expect(stop).toHaveBeenCalled();
    expect(failure).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
  });
});
