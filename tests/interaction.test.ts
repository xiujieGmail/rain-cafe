import { describe, expect, it, vi } from 'vitest';
import { InteractionEngine, type InteractionDependencies } from '../src/lib/interaction';
import { TurnGate } from '../src/lib/turn-gate';
import { mockReply } from '../src/lib/mock';
import { performanceSchema, type TurnReply } from '../src/lib/protocol';
import type { SceneState } from '../src/stores/scene-store';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup(overrides: Partial<InteractionDependencies> = {}) {
  const state: SceneState = { transcript: [], phase: 'idle', emotion: 'calm', action: 'idle', scene: 'rain', story: 'arrival', subtitle: '', userText: '', notice: '', error: '', media: false, mediaFailed: false, latency: null, turnId: 0 };
  const trace = vi.fn();
  const speak = vi.fn(async (_reply: TurnReply, _mode, _fault, _signal, onStart: () => void) => { onStart(); });
  const engine = new InteractionEngine({
    transcribe: async () => '我可以陪你',
    respond: async input => ({ ...mockReply(input.text, input.story), turnId: input.turnId, elapsedMs: 1 }),
    speak,
    patch: patch => Object.assign(state, patch), trace, getStory: () => state.story,
    ...overrides,
  });
  return { engine, state, trace, speak };
}

describe('recording upload and dialogue', () => {
  it('transcribes actual audio and automatically replies in mock mode on the same turn', async () => {
    const transcribe = vi.fn(async () => '看看你的照片');
    const onTranscript = vi.fn();
    const { engine, state, speak, trace } = setup({ transcribe });
    const ticket = engine.beginListening();
    const blob = new Blob(['recorded audio'], { type: 'audio/mp4' });
    await engine.submitRecording(blob, 'mock', 'none', ticket, onTranscript);
    expect(transcribe).toHaveBeenCalledWith(blob, ticket.controller.signal);
    expect(onTranscript).toHaveBeenCalledWith('看看你的照片');
    expect(state.userText).toBe('看看你的照片');
    expect(state.media).toBe(true);
    expect(state.turnId).toBe(ticket.id);
    expect(state.phase).toBe('idle');
    expect(speak.mock.calls[0][1]).toBe('mock');
    expect(trace).toHaveBeenCalledWith(ticket.id, 'STT 完成 / 自动提交对话');
  });

  it('aborts an upload and ignores late transcripts after a new turn', async () => {
    const late = deferred<string>();
    const transcribe = vi.fn(() => late.promise);
    const { engine, state, speak } = setup({ transcribe });
    const ticket = engine.beginListening();
    const pending = engine.submitRecording(new Blob(['audio']), 'mock', 'none', ticket);
    expect(state.notice).toContain('上传');
    await engine.submit('我可以陪你', 'mock');
    const subtitle = state.subtitle;
    expect(ticket.controller.signal.aborted).toBe(true);
    late.resolve('看看照片');
    await pending;
    expect(state.subtitle).toBe(subtitle);
    expect(state.media).toBe(false);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('shows transcription failure without making up a dialogue and allows recording again', async () => {
    const transcribe = vi.fn().mockRejectedValueOnce(new Error('语音识别尚未配置')).mockResolvedValueOnce('我可以陪你');
    const { engine, state, speak } = setup({ transcribe });
    await engine.submitRecording(new Blob(['audio']), 'mock', 'none', engine.beginListening());
    expect(state.phase).toBe('idle');
    expect(state.error).toContain('尚未配置');
    expect(speak).not.toHaveBeenCalled();
    await engine.submitRecording(new Blob(['audio']), 'mock', 'none', engine.beginListening());
    expect(state.error).toBe('');
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('rejects empty audio and empty transcripts without submitting a response', async () => {
    const transcribe = vi.fn(async () => '  ');
    const { engine, state, speak } = setup({ transcribe });
    await engine.submitRecording(new Blob([]), 'mock', 'none', engine.beginListening());
    expect(transcribe).not.toHaveBeenCalled();
    expect(state.error).toContain('为空');
    await engine.submitRecording(new Blob(['audio']), 'mock', 'none', engine.beginListening());
    expect(state.error).toContain('没有听清');
    expect(speak).not.toHaveBeenCalled();
  });
});

describe('turn cancellation', () => {
  it('invalidates the old ticket before cleaning queued events', () => {
    const gate = new TurnGate();
    const old = gate.begin();
    let validDuringCleanup = true;
    gate.register(old, () => { validDuringCleanup = gate.isCurrent(old); });
    const current = gate.begin();
    expect(validDuringCleanup).toBe(false);
    expect(old.controller.signal.aborted).toBe(true);
    expect(gate.isCurrent(current)).toBe(true);
  });

  it('drops a late network reply even if the provider ignores abort', async () => {
    const late = deferred<unknown>();
    let oldTurn = 0;
    const { engine, state, speak } = setup({ respond: async input => {
      if (input.text === '旧输入') { oldTurn = input.turnId; return late.promise; }
      return { ...mockReply(input.text, input.story), turnId: input.turnId, elapsedMs: 1 };
    } });
    const old = engine.submit('旧输入', 'mock');
    await engine.submit('我可以陪你', 'mock');
    const currentSubtitle = state.subtitle;
    late.resolve({ ...mockReply('照片', 'arrival'), turnId: oldTurn, elapsedMs: 9000 });
    await old;
    expect(state.subtitle).toBe(currentSubtitle);
    expect(state.media).toBe(false);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('aborts playing audio and ignores old start, ended and speech_end events', async () => {
    const playback = deferred<void>();
    let oldStart!: () => void;
    let audioSignal!: AbortSignal;
    const { engine, state } = setup({
      respond: async input => ({ ...mockReply('你好', 'arrival'), turnId: input.turnId, elapsedMs: 1, events: [{ on: 'speech_end', type: 'scene', name: 'rain_clears' }] }),
      speak: async (_reply, _mode, _fault, signal, start) => { audioSignal = signal; oldStart = start; start(); return playback.promise; },
    });
    const pending = engine.submit('你好', 'mock');
    await vi.waitFor(() => expect(state.phase).toBe('speaking'));
    engine.beginListening();
    expect(audioSignal.aborted).toBe(true);
    oldStart();
    playback.resolve();
    await pending;
    expect(state.phase).toBe('listening');
    expect(state.subtitle).toBe('');
    expect(state.scene).toBe('rain');
  });

  it('rejects a stale recorded transcript after a newer text turn', async () => {
    const { engine, state, speak } = setup();
    const recording = engine.beginListening();
    await engine.submit('我可以陪你', 'mock');
    const current = state.subtitle;
    await engine.submit('照片', 'mock', 'none', recording);
    expect(state.subtitle).toBe(current);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('does not present a response bearing the wrong turn id', async () => {
    const { engine, state, speak } = setup({ respond: async () => ({ ...mockReply('你好', 'arrival'), turnId: 999, elapsedMs: 1 }) });
    await engine.submit('你好', 'mock');
    expect(state.error).toContain('轮次');
    expect(speak).not.toHaveBeenCalled();
  });
});

describe('continuous scene and recovery', () => {
  it('preserves story context, moves the environment and triggers a dialogue-specific photo', async () => {
    const { engine, state } = setup();
    await engine.submit('你在等谁', 'mock');
    expect(state.emotion).toBe('guarded');
    expect(state.action).toBe('look_window');
    await engine.submit('我可以陪你', 'mock');
    expect(state.scene).toBe('warm');
    await engine.submit('看看照片', 'mock');
    expect(state.media).toBe(true);
    expect(state.action).toBe('show_camera');
    await engine.submit('你等的是谁', 'mock');
    expect(state.subtitle).toContain('海边车站');
    await engine.submit('出去走走', 'mock');
    expect(state.scene).toBe('clear');
    expect(state.phase).toBe('idle');
  });

  it('keeps usable text and performance when audio fails and accepts the next turn', async () => {
    const { engine, state } = setup({ speak: async () => { throw new Error('Audio failed'); } });
    await engine.submit('照片', 'mock', 'audio');
    expect(state.subtitle).toContain('照片');
    expect(state.notice).toContain('字幕');
    expect(state.media).toBe(true);
    expect(state.phase).toBe('idle');
    await engine.submit('出去走走', 'mock');
    expect(state.scene).toBe('clear');
  });

  it('surfaces a model failure and recovers with a later turn', async () => {
    let fail = true;
    const { engine, state } = setup({ respond: async input => {
      if (fail) { fail = false; throw new Error('模型超时'); }
      return { ...mockReply(input.text, input.story), turnId: input.turnId, elapsedMs: 1 };
    } });
    await engine.submit('你好', 'mock');
    expect(state.error).toContain('超时');
    expect(state.phase).toBe('idle');
    await engine.submit('你好', 'mock');
    expect(state.error).toBe('');
    expect(state.subtitle).toContain('米拉');
  });

  it('degrades a failed photo without stopping the character', async () => {
    const { engine, state } = setup();
    await engine.submit('照片', 'mock', 'media');
    expect(state.mediaFailed).toBe(true);
    expect(state.media).toBe(false);
    expect(state.action).toBe('show_camera');
    expect(state.subtitle).toContain('照片');
  });

  it('does not permit a model to smuggle a media resource into a scene event', () => {
    expect(performanceSchema.safeParse({ text: '你好', emotion: 'calm', story: 'arrival', events: [{ on: 'speech_start', type: 'scene', name: 'travel_photo' }] }).success).toBe(false);
  });
});

describe('visible dialogue history', () => {
  it('preserves multiple rounds separately from the bounded model context and clears on reset', async () => {
    const { engine, state } = setup();
    await engine.submit('你好', 'mock'); await engine.submit('照片', 'mock');
    expect(state.transcript.map(entry => entry.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(state.transcript.every(entry => entry.status === 'complete')).toBe(true);
    engine.reset(); expect(state.transcript).toEqual([]);
  });
  it('marks interrupted speech without admitting late replies or clearing earlier text', async () => {
    const oldPlayback = deferred<void>();
    const { engine, state } = setup({ speak: async (_reply, _mode, _fault, signal, start) => {
      start(); if (!signal.aborted) await oldPlayback.promise;
    } });
    const pending = engine.submit('照片', 'mock');
    await vi.waitFor(() => expect(state.phase).toBe('speaking'));
    engine.beginListening();
    expect(state.transcript).toHaveLength(2);
    expect(state.transcript[1].text).toContain('照片'); expect(state.transcript[1].status).toBe('interrupted');
    oldPlayback.resolve(); await pending;
    expect(state.transcript[1].status).toBe('interrupted'); expect(state.phase).toBe('listening');
  });
  it('records failures and bounds the displayed history', async () => {
    const failed = setup({ respond: async () => { throw new Error('test failure'); } });
    await failed.engine.submit('你好', 'live'); expect(failed.state.transcript[0].status).toBe('failed');
    const { engine, state } = setup();
    for (let i=0;i<60;i++) await engine.submit(`你好${i}`, 'mock');
    expect(state.transcript).toHaveLength(100); expect(state.transcript.at(-1)?.status).toBe('complete');
  });
});
