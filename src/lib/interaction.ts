import { responseSchema, type Fault, type History, type SceneEvent, type TurnReply, type TurnRequest } from './protocol';
import { TurnGate, type Ticket } from './turn-gate';
import type { SceneState } from '../stores/scene-store';

export type InteractionDependencies = {
  transcribe: (blob: Blob, signal: AbortSignal) => Promise<string>;
  respond: (request: TurnRequest, signal: AbortSignal) => Promise<unknown>;
  speak: (reply: TurnReply, mode: 'mock' | 'live', fault: Fault, signal: AbortSignal, onStart: () => void) => Promise<void>;
  patch: (patch: Partial<SceneState>) => void;
  trace: (turn: number, stage: string) => void;
  getStory: () => SceneState['story'];
};

export class InteractionEngine {
  readonly gate = new TurnGate();
  private history: History = [];
  private interruptedSpeech = false;
  constructor(private deps: InteractionDependencies) {}

  beginListening(): Ticket {
    const ticket = this.begin();
    this.deps.patch({ phase: 'listening', notice: '正在听你说话…', turnId: ticket.id });
    this.deps.trace(ticket.id, '倾听开始 / 旧轮失效');
    return ticket;
  }
  private begin() {
    const ticket = this.gate.begin();
    // 被打断的回复只记录中断标记，避免模型误以为用户听完了整段台词。
    if (this.interruptedSpeech) this.history.push({ role: 'assistant', content: '（上一轮回复被用户打断，未完整播放。）' });
    this.interruptedSpeech = false;
    // 清除旧轮字幕、动作和媒体，新的倾听画面不继承尚未完成的演出。
    this.deps.patch({ subtitle: '', error: '', notice: '', media: false, mediaFailed: false, action: 'idle', userText: '', latency: null });
    return ticket;
  }
  cancel() {
    this.gate.invalidate();
    // 被打断的回复只记录中断标记，避免模型误以为用户听完了整段台词。
    if (this.interruptedSpeech) this.history.push({ role: 'assistant', content: '（上一轮回复被用户打断，未完整播放。）' });
    this.interruptedSpeech = false;
    this.deps.patch({ phase: 'idle', subtitle: '', media: false, action: 'idle', notice: '已停止。你可以继续说话。' });
  }
  reset() { this.gate.invalidate(); this.history = []; this.interruptedSpeech = false; }

  async submitRecording(blob: Blob, mode: 'mock' | 'live', fault: Fault, ticket: Ticket, onTranscript?: (text: string) => void): Promise<string | undefined> {
    if (!this.gate.isCurrent(ticket)) return;
    this.deps.patch({ phase: 'thinking', notice: '正在上传录音并识别你的声音…', error: '' });
    this.deps.trace(ticket.id, '录音上传 / STT 请求');
    let text: string;
    try {
      if (!blob.size) throw new Error('录音为空，请重新录制。');
      // 演示和真实模式都使用实际录音转写，识别失败时不生成模拟文字。
      text = (await this.deps.transcribe(blob, ticket.controller.signal)).trim().slice(0, 500);
      if (!this.gate.isCurrent(ticket)) return;
      if (!text) throw new Error('没有听清，请再说一次。');
    } catch (error) {
      if (!this.gate.isCurrent(ticket)) return;
      this.deps.patch({ phase: 'idle', error: error instanceof Error ? error.message : '语音识别失败，请重新录制或使用文字。', notice: '' });
      this.deps.trace(ticket.id, 'STT 失败 / 可重新录制');
      return;
    }
    this.deps.trace(ticket.id, 'STT 完成 / 自动提交对话');
    onTranscript?.(text);
    // 录音与识别后的对话复用同一个轮次，保留整条链路的取消语义。
    await this.submit(text, mode, fault, ticket);
    return this.gate.isCurrent(ticket) ? text : undefined;
  }

  private event(event: SceneEvent, fault: Fault, ticket: Ticket) {
    if (!this.gate.isCurrent(ticket)) return;
    const patch: Partial<SceneState> = {};
    if (event.type === 'action') patch.action = event.name === 'show_camera' ? 'show_camera' : 'look_window';
    if (event.type === 'scene') patch.scene = event.name === 'warm_light' ? 'warm' : 'clear';
    if (event.type === 'media') {
      patch.media = fault !== 'media';
      patch.mediaFailed = fault === 'media';
      if (fault === 'media') patch.notice = '演示：照片加载失败。已保留角色动画，可以继续交流。';
    }
    this.deps.patch(patch);
    this.deps.trace(ticket.id, `演出 / ${event.name}${fault === 'media' && event.type === 'media' ? ' / 已降级' : ''}`);
  }

  async submit(text: string, mode: 'mock' | 'live', fault: Fault = 'none', listeningTicket?: Ticket) {
    text = text.trim().slice(0, 500);
    if (!text) return;
    const ticket = listeningTicket || this.begin();
    if (!this.gate.isCurrent(ticket)) return;
    // 限制上下文长度，避免连续交流时请求体和模型输入无限增长。
    const previousHistory = this.history.slice(-14);
    this.history = [...previousHistory, { role: 'user', content: text }];
    this.deps.patch({ phase: 'thinking', userText: text, notice: '她在想怎么回答…', turnId: ticket.id, error: '' });
    this.deps.trace(ticket.id, '模型请求');
    const started = performance.now();
    let reply: TurnReply;
    try {
      const raw = await this.deps.respond({ text, mode, fault, turnId: ticket.id, story: this.deps.getStory(), history: previousHistory }, ticket.controller.signal);
      if (!this.gate.isCurrent(ticket)) return;
      // 网络返回后再次检查当前轮次，并校验演出协议与回复轮次。
      reply = responseSchema.parse(raw);
      if (reply.turnId !== ticket.id) throw new Error('回复轮次不匹配，请重试。');
    } catch (error) {
      if (!this.gate.isCurrent(ticket)) return;
      this.deps.patch({ phase: 'idle', error: error instanceof Error ? error.message : '回复失败，请重试。', notice: '' });
      this.deps.trace(ticket.id, '模型失败 / 可重试');
      return;
    }
    let hasStarted = false;
    // 实际开始播放时才发布字幕与演出；守卫保证重复播放回调不会重复触发事件。
    const start = () => {
      if (!this.gate.isCurrent(ticket) || hasStarted) return;
      hasStarted = true;
      this.interruptedSpeech = true;
      this.deps.patch({ phase: 'speaking', subtitle: reply.text, emotion: reply.emotion, story: reply.story, notice: '', latency: Math.round(performance.now() - started) });
      this.deps.trace(ticket.id, '语音开始 / 字幕与演出发布');
      for (const event of reply.events.filter(event => event.on === 'speech_start')) this.event(event, fault, ticket);
    };
    try {
      this.deps.patch({ notice: '正在准备她的声音…' });
      await this.deps.speak(reply, mode, fault, ticket.controller.signal, start);
      if (!this.gate.isCurrent(ticket)) return;
      if (!hasStarted) throw new Error('没有检测到语音播放。');
    } catch {
      if (!this.gate.isCurrent(ticket)) return;
      // 已有有效回复时，音频失败降级为字幕和角色演出，用户仍可继续交流。
      start();
      this.deps.patch({ notice: fault === 'audio' ? '演示：语音加载失败，已切换为字幕。可以继续交流。' : '语音暂时无法播放，已切换为字幕。可以继续交流。' });
      this.deps.trace(ticket.id, '语音失败 / 字幕降级');
    }
    if (!this.gate.isCurrent(ticket)) return;
    this.interruptedSpeech = false;
    this.history.push({ role: 'assistant', content: reply.text });
    this.history = this.history.slice(-14);
    // 只有未被打断的有效轮次才能触发播放结束后的场景事件。
    for (const event of reply.events.filter(event => event.on === 'speech_end')) this.event(event, fault, ticket);
    this.deps.patch({ phase: 'idle' });
    this.deps.trace(ticket.id, '轮次完成');
  }
}
