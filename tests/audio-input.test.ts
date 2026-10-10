import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectSamples, encodeMonoWav } from '../src/lib/audio-input';
import { transcribe } from '../src/lib/browser-services';

afterEach(() => vi.unstubAllGlobals());

describe('actual recording inspection and speech format', () => {
  it('distinguishes a silent microphone from quiet but usable speech', () => {
    expect(inspectSamples(new Float32Array(48000), 16000)).toMatchObject({ duration: 3, silent: true });
    expect(inspectSamples(new Float32Array(48000).fill(0.001), 16000)).toMatchObject({ silent: false, quiet: true });
  });
  it('writes an actual mono PCM WAV with duration and clipped signed samples', async () => {
    const blob = encodeMonoWav(new Float32Array([-2, -0.5, 0, 0.5, 2]), 16000);
    const view = new DataView(await blob.arrayBuffer());
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(54);
    expect(new TextDecoder().decode(new Uint8Array(view.buffer, 0, 4))).toBe('RIFF');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(10);
    expect(view.getInt16(44, true)).toBe(-32768);
    expect(view.getInt16(52, true)).toBe(32767);
  });
  it('uploads PCM recordings with a WAV filename rather than disguising them as WebM', async () => {
    const fetch = vi.fn(async () => Response.json({ text: '你好' }));
    vi.stubGlobal('fetch', fetch);
    await expect(transcribe(encodeMonoWav(new Float32Array(16000), 16000), new AbortController().signal)).resolves.toBe('你好');
    const upload = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    const file = upload.get('audio') as File;
    expect(file.name).toBe('recording.wav');
    expect(file.type).toBe('audio/wav');
  });
});
