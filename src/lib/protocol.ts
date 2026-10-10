import { z } from 'zod';

export const emotionSchema = z.enum(['calm', 'guarded', 'warm', 'wistful']);
export const actionSchema = z.enum(['idle', 'look_window', 'show_camera']);
export const sceneSchema = z.enum(['rain', 'warm', 'clear']);
export const storySchema = z.enum(['arrival', 'waiting', 'trust', 'photo', 'departure']);
// 演出资源采用白名单，并校验事件类型与资源匹配，禁止模型指定任意媒体地址。
export const eventSchema = z.object({
  on: z.enum(['speech_start', 'speech_end']),
  type: z.enum(['action', 'scene', 'media']),
  name: z.enum(['look_window', 'show_camera', 'warm_light', 'rain_clears', 'travel_photo']),
}).refine(event => ({ action: ['look_window', 'show_camera'], scene: ['warm_light', 'rain_clears'], media: ['travel_photo'] })[event.type].includes(event.name), 'Event type and resource must match');
export const performanceSchema = z.object({
  text: z.string().min(1).max(600),
  emotion: emotionSchema,
  events: z.array(eventSchema).max(4),
  story: storySchema,
});
export const historySchema = z.array(z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(1000),
})).max(16);
export const faultSchema = z.enum(['none', 'timeout', 'audio', 'media', 'slow']);
export const requestSchema = z.object({
  turnId: z.number().int().positive(),
  text: z.string().trim().min(1).max(500),
  mode: z.enum(['mock', 'live']),
  story: storySchema,
  history: historySchema,
  fault: faultSchema.default('none'),
});
export const responseSchema = performanceSchema.extend({
  turnId: z.number().int().positive(),
  audioId: z.string().regex(/^[a-z_]+$/).optional(),
  elapsedMs: z.number().nonnegative(),
});
export type Performance = z.infer<typeof performanceSchema>;
export type SceneEvent = z.infer<typeof eventSchema>;
export type TurnRequest = z.infer<typeof requestSchema>;
export type TurnReply = z.infer<typeof responseSchema>;
export type Emotion = z.infer<typeof emotionSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Story = z.infer<typeof storySchema>;
export type Fault = z.infer<typeof faultSchema>;
export type History = z.infer<typeof historySchema>;
export type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';
