'use client';
import { assetPath, staticPreview } from '@/lib/preview';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Mic, Square, RotateCcw, SlidersHorizontal, X, ChevronRight, Headphones, Sparkles, MessageCircle, Radio, Activity } from 'lucide-react';
import { SceneStage } from './scene-stage';
import { useSceneStore } from '@/stores/scene-store';
import { InteractionEngine } from '@/lib/interaction';
import { respond, speak, record, transcribe, type Recording } from '@/lib/browser-services';
import { prepareRecording, type AudioInspection } from '@/lib/audio-input';
import type { Fault } from '@/lib/protocol';
import type { Ticket } from '@/lib/turn-gate';

const phaseNames = { idle: '待机', listening: '倾听', thinking: '思考', speaking: '说话' };
const phaseCopy = { idle: '她在这里，等你开口', listening: '她正认真听你说', thinking: '她正在想怎么回答', speaking: '她正在说话 · 可直接打断' };
const mockPrompts = ['你为什么还在这里等？', '我可以陪你坐一会儿。', '可以看看你的照片吗？', '雨停了，我们出去走走吧。'];

export function CafeExperience() {
  const state = useSceneStore();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [settings, setSettings] = useState(false);
  const [fault, setFault] = useState<Fault>('none');
  const [picker, setPicker] = useState(false);
  const [recordingReady, setRecordingReady] = useState(false);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [microphoneId, setMicrophoneId] = useState('');
  const [microphoneName, setMicrophoneName] = useState('系统默认麦克风');
  const [inputLevel, setInputLevel] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [recordingInfo, setRecordingInfo] = useState<AudioInspection | null>(null);
  const recordingRef = useRef<Recording | null>(null);
  const listeningRef = useRef<Ticket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const lastInput = useRef('');
  const [engine] = useState(() => new InteractionEngine({
    respond, speak, transcribe,
    patch: value => useSceneStore.getState().patch(value),
    trace: (turn, stage) => useSceneStore.getState().trace(turn, stage),
    getStory: () => useSceneStore.getState().story,
  }));

  useEffect(() => {
    const controller = new AbortController();
    if (!staticPreview) fetch('/api/config', { signal: controller.signal }).then(response => response.json()).then(config => setLiveAvailable(config.liveAvailable === true)).catch(() => {});
    // 页面卸载时一起取消配置请求、当前对话和麦克风录音。
    return () => { controller.abort(); engine.reset(); recordingRef.current?.cancel(); };
  }, [engine]);

  async function refreshMicrophones() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try { setMicrophones((await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput')); }
    catch {
      // 浏览器未开放设备列表时仍允许使用默认麦克风。
    }
  }
  useEffect(() => {
    void refreshMicrophones();
    navigator.mediaDevices?.addEventListener('devicechange', refreshMicrophones);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refreshMicrophones);
  }, []);
  // 回放只保留最近一段录音在浏览器内存中，替换或离开页面时释放。
  useEffect(() => () => { if (recordingUrl) URL.revokeObjectURL(recordingUrl); }, [recordingUrl]);

  useEffect(() => {
    if (!settings) return;
    const previous = document.activeElement as HTMLElement | null;
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSettings(false); return; }
      if (event.key !== 'Tab') return;
      const items = [...(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), summary, a[href]') || [])];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [settings]);

  function stopRecordingUI() {
    recordingRef.current?.cancel();
    recordingRef.current = null;
    listeningRef.current = null;
    setRecordingReady(false);
    setInputLevel(0);
    setPicker(false);
  }
  function send(text: string, ticket?: Ticket) {
    if (!text.trim()) return;
    if (!ticket) stopRecordingUI();
    else { listeningRef.current = null; recordingRef.current = null; setPicker(false); setRecordingReady(false); }
    lastInput.current = text;
    setInput('');
    const selectedFault = mode === 'mock' ? fault : 'none';
    setFault('none');
    void engine.submit(text, mode, selectedFault, ticket);
  }
  function submit(event: FormEvent) { event.preventDefault(); send(input); }
  function simulateVoice() {
    stopRecordingUI();
    lastInput.current = '';
    listeningRef.current = engine.beginListening();
    setPicker(true);
    useSceneStore.getState().patch({ notice: '模拟语音输入：选择一句转写内容。此模式不会识别或上传录音。' });
  }
  async function microphone() {
    if (recordingRef.current) { recordingRef.current.stop(); setRecordingReady(false); return; }
    if (listeningRef.current) { engine.cancel(); stopRecordingUI(); return; }
    lastInput.current = '';
    const ticket = engine.beginListening();
    // 录音开始时固定模式与一次性故障，异步回调不读取后来切换的设置。
    const recordingMode = mode;
    const recordingFault = mode === 'mock' ? fault : 'none';
    setFault('none');
    listeningRef.current = ticket;
    setRecordingUrl(''); setRecordingInfo(null); setInputLevel(0);
    try {
      const recording = await record(ticket.controller.signal, async blob => {
        if (!engine.gate.isCurrent(ticket)) return;
        recordingRef.current = null;
        setRecordingReady(false);
        setRecordingUrl(URL.createObjectURL(blob));
        let prepared;
        try {
          useSceneStore.getState().patch({ phase: 'thinking', notice: '正在检查录音…' });
          prepared = await prepareRecording(blob);
          if (!engine.gate.isCurrent(ticket)) return;
          setRecordingInfo(prepared.inspection);
          useSceneStore.getState().trace(ticket.id, `录音检查 / ${prepared.inspection.duration.toFixed(1)} 秒 / ${prepared.inspection.silent ? '静音' : prepared.inspection.quiet ? '低音量' : '有声'} / WAV`);
          if (prepared.inspection.duration < 0.4) throw new Error('录音太短。请等录音按钮变为方形后，说完一句话再点击结束。');
          if (prepared.inspection.silent) throw new Error('麦克风没有采集到声音。请在体验设置中切换输入设备，并检查系统麦克风是否静音。');
        } catch (error) {
          if (!engine.gate.isCurrent(ticket)) return;
          listeningRef.current = null;
          useSceneStore.getState().patch({ phase: 'idle', notice: '', error: error instanceof DOMException ? '录音无法解码，请更换浏览器后重录。' : error instanceof Error ? error.message : '录音无法解码，请更换浏览器后重录。' });
          return;
        }
        // 真实转写后自动对话；只有当前轮次能更新输入记录和录音界面。
        const text = await engine.submitRecording(prepared.blob, recordingMode, recordingFault, ticket, text => {
          listeningRef.current = null;
          lastInput.current = text;
        });
        if (engine.gate.isCurrent(ticket)) {
          listeningRef.current = null;
          if (text) lastInput.current = text;
        }
      }, error => {
        if (!engine.gate.isCurrent(ticket)) return;
        recordingRef.current = null; listeningRef.current = null; setRecordingReady(false);
        useSceneStore.getState().patch({ phase: 'idle', error: error.message, notice: '' });
      }, { deviceId: microphoneId, onLevel: level => { if (engine.gate.isCurrent(ticket)) setInputLevel(level); }, onDevice: name => { if (engine.gate.isCurrent(ticket)) setMicrophoneName(name); } });
      if (!engine.gate.isCurrent(ticket)) { recording.cancel(); return; }
      recordingRef.current = recording;
      setRecordingReady(true);
      void refreshMicrophones();
      useSceneStore.getState().patch({ notice: '录音已就绪，请开始说话，说完后点击方形按钮结束。最长 45 秒。' });
    } catch (error) {
      if (!engine.gate.isCurrent(ticket)) return;
      listeningRef.current = null;
      const message = error instanceof Error && error.name === 'NotAllowedError' ? '麦克风未获授权。请检查浏览器和系统的麦克风权限。'
        : error instanceof Error && (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') ? '所选麦克风不可用。请在体验设置中选择系统默认或其他输入设备。'
        : error instanceof Error && error.name === 'NotReadableError' ? '无法读取麦克风。请检查系统输入设备，或关闭占用麦克风的其他应用后重试。'
        : error instanceof Error ? error.message : '麦克风不可用，请使用文字。';
      useSceneStore.getState().patch({ phase: 'idle', error: message, notice: '' });
    }
  }
  function restart() {
    engine.reset(); stopRecordingUI(); useSceneStore.getState().reset(); setInput(''); setFault('none'); lastInput.current = ''; setRecordingUrl(''); setRecordingInfo(null);
  }
  function changeMode(next: 'mock' | 'live') { restart(); setMode(next); }

  return <main className="experience" data-phase={state.phase} data-turn={state.turnId}>
    <SceneStage />
    <header className="topbar">
      <a className="wordmark" href={assetPath('/')} aria-label="雨隙，雨夜咖啡馆"><span className="brand-mark">雨</span><span>雨隙<small>a moment between the rain</small></span></a>
      <div className="top-actions"><span className="mode-badge"><i />{mode === 'mock' ? staticPreview ? '在线演示' : '本地演示' : '真实对话'}</span><button className="icon-button" onClick={restart} aria-label="重新开始故事" title="重新开始"><RotateCcw size={18} /></button><button className="icon-button" onClick={() => setSettings(true)} aria-label="打开体验设置" title="体验设置"><SlidersHorizontal size={18} /></button></div>
    </header>
    <aside className="story-intro"><p className="eyebrow">第一幕 / 雨夜的偶遇</p><h1>雨声渐慢，<br />故事刚开始。</h1><p>一杯还温热的咖啡，<br />一个等你开口的人。</p><span className="story-coordinate">23:17 &nbsp; / &nbsp; 雨后 · 城市一角</span></aside>
    <div className="character-caption"><span className="tiny-star">✦</span><span>Mira<small>26 岁 · 旅行摄影师</small></span></div>
    <section className="conversation" aria-label="与 Mira 交流">
      <div className={`status-line status-${state.phase}`}><span className="status-orb"><i /><i /><i /></span><span data-testid="phase-label">{phaseNames[state.phase]}</span><span className="status-copy">{phaseCopy[state.phase]}</span>{state.phase === 'speaking' ? <button className="inline-stop" onClick={() => { engine.cancel(); stopRecordingUI(); }}><Square size={11} />停止</button> : null}</div>
      <div className="subtitle-area" aria-live="polite" aria-atomic="true"><span className="speaker-label">MIRA</span><p data-testid="subtitle">{state.subtitle || (state.phase === 'listening' ? '“ 我在听。 ”' : state.phase === 'thinking' ? '窗外的雨声，填满了片刻的安静。' : '你可以继续这个故事。')}</p></div>
      {state.userText ? <p className="your-line"><span>你</span>{state.userText}</p> : null}
      {recordingReady ? <div className="microphone-level" role="status"><span className="level-track"><span style={{ width: `${Math.round(inputLevel * 100)}%` }} /></span><span>{inputLevel > 0.01 ? '已检测到声音' : '等待声音，请检查麦克风'}</span></div> : null}
      {state.error ? <div className="feedback error" role="alert"><span>{state.error}</span>{lastInput.current ? <button onClick={() => send(lastInput.current)}>重试<ChevronRight size={13} /></button> : null}</div> : state.notice ? <p className="feedback" role="status">{state.notice}</p> : null}
      {picker ? <div className="voice-picker" aria-label="模拟语音转写"><div><Radio size={15} /><span>选择模拟转写</span><button className="icon-button" aria-label="取消模拟输入" onClick={() => { engine.cancel(); stopRecordingUI(); }}><X size={16} /></button></div>{mockPrompts.map(prompt => <button key={prompt} onClick={() => { const ticket = listeningRef.current; if (ticket) send(prompt, ticket); }}>{prompt}<ChevronRight size={14} /></button>)}</div> : null}
      <div className="suggestions" aria-label="对话灵感">{(state.story === 'photo' ? ['你等的是谁？', '雨停了，我们出去走走吧。'] : ['你在等谁？', '我可以陪你。', '看看你的照片？']).map(prompt => <button key={prompt} onClick={() => send(prompt)}>{prompt}<ChevronRight size={12} /></button>)}</div>
      <form className={`input-bar ${recordingReady ? 'is-recording' : ''}`} onSubmit={submit}>
        <label className="sr-only" htmlFor="message">对 Mira 说些什么</label>
        <textarea ref={textareaRef} id="message" value={input} maxLength={500} rows={1} placeholder="对她说些什么…" onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(input); } }} />
        {input ? <span className="input-count">{input.length}/500</span> : null}
        <button type="button" className={`mic-button ${recordingReady ? 'active' : ''}`} onClick={() => void microphone()} aria-label={recordingReady ? '结束录音' : listeningRef.current ? '取消语音输入' : state.phase === 'speaking' ? '打断并开始录音' : '开始录音'} title="点击开始/结束录音，可打断角色">{recordingReady ? <Square size={17} fill="currentColor" /> : <Mic size={20} />}</button>
        <button type="submit" className="send-button" disabled={!input.trim()} aria-label="发送文字"><ArrowUp size={21} /></button>
      </form>
      <div className="interaction-hint"><span><Headphones size={12} />戴上耳机，听她的故事</span>{mode === 'mock' ? <button onClick={simulateVoice}><Radio size={12} />模拟语音输入</button> : <span>录音时会立即打断她</span>}</div>
    </section>
    <footer className="scene-footer"><span>一次偶遇，无需赶路。</span><span>雨夜咖啡馆 · 第一章</span></footer>
    {settings ? <div className="drawer-backdrop" onClick={() => setSettings(false)}><section ref={drawerRef} className="settings-drawer" role="dialog" aria-modal="true" aria-label="体验设置" onClick={event => event.stopPropagation()}>
      <div className="drawer-header"><div><p className="eyebrow">EXPERIENCE</p><h2>体验设置</h2></div><button className="icon-button" onClick={() => setSettings(false)} aria-label="关闭体验设置" autoFocus><X size={21} /></button></div>
      <p className="settings-copy">这是一段可以被你打断、也可以慢慢继续的故事。</p>
      <label className="setting-label" htmlFor="mode">对话模式</label><select id="mode" value={mode} onChange={event => changeMode(event.target.value as 'mock' | 'live')}><option value="mock">本地演示 · 剧情与预录语音</option><option value="live" disabled={!liveAvailable}>真实服务{liveAvailable ? ' · 已配置' : ' · 尚未配置密钥'}</option></select>
      <p className="setting-note">{staticPreview ? 'GitHub Pages 在线演示：支持文字、模拟语音输入、预录语音与角色演出。实际录音识别和真实模型对话需要本地后端配置服务。' : mode === 'mock' ? '使用预录中文语音和剧情规则。结束录音后自动上传至语音识别服务，识别完成后继续对话。录音不会保存到本地服务器磁盘。实际录音需要配置语音识别服务；模拟输入无需配置。' : '录音与对话会发送到服务端配置的模型服务。点击麦克风开始或结束录音。'}</p>
      {!staticPreview ? <><label className="setting-label" htmlFor="microphone-device">麦克风输入</label><select id="microphone-device" value={microphoneId} disabled={recordingReady} onChange={event => setMicrophoneId(event.target.value)}><option value="">系统默认麦克风</option>{microphones.filter(device => device.deviceId && device.deviceId !== 'default').map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `麦克风 ${index + 1}`}</option>)}</select><p className="setting-note">当前采集设备：{microphoneName}。授权后显示设备名称；若音量条没有变化，请选择内置麦克风或实际使用的耳机麦克风。</p></> : null}
      {recordingUrl && !recordingReady ? <div className="recording-preview"><p className="setting-label">回放本次录音</p><audio controls src={recordingUrl} onPlay={() => { engine.cancel(); stopRecordingUI(); }} aria-label="回放本次麦克风录音" /><p className="setting-note">{recordingInfo ? `${recordingInfo.duration.toFixed(1)} 秒 · ${recordingInfo.silent ? '未采集到声音' : recordingInfo.quiet ? '声音偏小，请靠近麦克风' : '已采集到声音'}。` : ''}仅临时保存在当前页面内存中，下一次录音或离开页面时清除。</p></div> : null}
      <div className="setting-rule" />
      <div className="setting-label"><Sparkles size={15} />演示一次故障</div><p className="setting-note">仅影响下一轮本地演示，提交后自动恢复正常。</p><select aria-label="下一轮故障模拟" value={fault} disabled={mode !== 'mock'} onChange={event => setFault(event.target.value as Fault)}><option value="none">正常体验</option><option value="timeout">模型超时 → 重试</option><option value="audio">语音失败 → 字幕降级</option><option value="media">照片失败 → 保留角色动画</option><option value="slow">旧回复延迟 7 秒 → 验证打断</option></select>
      <p className="setting-note">照片失败选项配合“看看你的照片？”使用。</p>
      <div className="setting-rule" /><div className="setting-label"><Activity size={15} />互动状态</div><dl className="diagnostic"><div><dt>当前轮次</dt><dd>#{state.turnId}</dd></div><div><dt>剧情节点</dt><dd>{state.story}</dd></div><div><dt>回复到播放</dt><dd>{state.latency === null ? '—' : `${state.latency} ms`}</dd></div><div><dt>表情 / 动作</dt><dd>{state.emotion} / {state.action}</dd></div></dl>
      <details className="trace-list"><summary>查看本次事件记录 <span>{state.traces.length}</span></summary>{state.traces.length ? state.traces.slice().reverse().map(trace => <p key={trace.id}><time>{trace.time}</time><span>#{trace.turnId} {trace.stage}</span></p>) : <p>还没有互动记录。</p>}</details>
      <button className="drawer-reset" onClick={() => { restart(); setSettings(false); }}><RotateCcw size={16} />重新开始这个夜晚</button>
      <p className="setting-note closing-note"><MessageCircle size={13} />每个回复与演出均属于当前轮次；开始新输入时，旧轮立即失效。</p>
    </section></div> : null}
  </main>;
}
