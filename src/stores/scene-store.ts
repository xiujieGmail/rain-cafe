import { create } from 'zustand';
import type { Action, Emotion, Phase, Scene, Story } from '@/lib/protocol';

export type SceneState = {
  phase: Phase;
  emotion: Emotion;
  action: Action;
  scene: Scene;
  story: Story;
  subtitle: string;
  userText: string;
  notice: string;
  error: string;
  media: boolean;
  mediaFailed: boolean;
  latency: number | null;
  turnId: number;
};
export const initialScene: SceneState = {
  phase: 'idle', emotion: 'calm', action: 'idle', scene: 'rain', story: 'arrival',
  subtitle: '雨刚停。她抬起眼，望向窗边的你。', userText: '',
  notice: '', error: '', media: false, mediaFailed: false, latency: null, turnId: 0,
};
export type Trace = { id: number; time: string; turnId: number; stage: string };
type Store = SceneState & { traces: Trace[]; patch: (value: Partial<SceneState>) => void; trace: (turnId: number, stage: string) => void; reset: () => void };
export const useSceneStore = create<Store>((set) => ({
  ...initialScene, traces: [],
  patch: value => set(value),
  // 只保留最近 40 条事件，便于定位打断与播放问题，避免长期对话无限积累记录。
  trace: (turnId, stage) => set(state => ({ traces: [...state.traces.slice(-39), { id: (state.traces.at(-1)?.id || 0) + 1, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), turnId, stage }] })),
  reset: () => set({ ...initialScene, traces: [] }),
}));
