'use client';
import { useState } from 'react';
import { customConfigSchema, emptyCustomConfig, getCustomConfig, type CustomConfig } from '@/lib/custom-services';

export function ServiceSettings({ enabled, onApply }: { enabled: boolean; onApply: (config: CustomConfig | null) => void }) {
  const [draft, setDraft] = useState<CustomConfig>(() => ({ ...(getCustomConfig() || emptyCustomConfig) }));
  const [error, setError] = useState('');
  const input = (name: Exclude<keyof CustomConfig, 'jsonMode'>, label: string, secret = false, placeholder?: string) => <label className="provider-field" key={name}><span>{label}</span><input type={secret ? 'password' : 'text'} autoComplete="off" spellCheck={false} value={draft[name]} placeholder={placeholder} onChange={event => setDraft(previous => ({ ...previous, [name]: event.target.value }))} /></label>;
  return <details className="provider-settings" open={enabled || undefined}><summary>自定义 AI 服务 <span>{enabled ? '已启用' : '未启用'}</span></summary>
    <p className="setting-note">配置任意 OpenAI 兼容服务；地址填写到 /v1 等 API 根路径。仅保留在当前页面，刷新清除。密钥及对话直接发送至你填写的服务；请使用可信地址和限额密钥。在线服务需允许 CORS。</p>
    {input('apiKey', 'OPENAI_API_KEY', true)}{input('baseUrl', 'OPENAI_BASE_URL')}{input('llmModel', 'LLM 模型')}
    <label className="provider-toggle"><input type="checkbox" checked={draft.jsonMode} onChange={event => setDraft(previous => ({ ...previous, jsonMode: event.target.checked }))} />请求 JSON 模式（不支持时关闭，模型仍需输出角色 JSON）</label>
    <h3>语音识别 STT</h3>{input('sttModel', 'STT 模型')}{input('sttBaseUrl', 'STT_BASE_URL（可选）', false, '留空复用 OPENAI_BASE_URL')}{input('sttKey', 'STT_API_KEY（可选）', true, '留空复用 OPENAI_API_KEY')}
    <h3>语音合成 TTS</h3>{input('ttsModel', 'TTS 模型')}{input('ttsVoice', 'TTS 音色')}{input('ttsBaseUrl', 'TTS_BASE_URL（可选）', false, '留空复用 OPENAI_BASE_URL')}{input('ttsKey', 'TTS_API_KEY（可选）', true, '留空复用 OPENAI_API_KEY')}
    {error ? <p role="alert" className="feedback error">{error}</p> : null}
    <div className="provider-actions"><button type="button" onClick={() => {
      const parsed = customConfigSchema.safeParse(draft);
      if (!parsed.success) { setError(parsed.error.issues[0]?.message || '请检查配置。'); return; }
      setError(''); onApply(parsed.data);
    }}>应用并切换真实对话</button><button type="button" onClick={() => { onApply(null); setDraft({ ...emptyCustomConfig }); setError(''); }}>清除自定义配置</button></div>
    <p className="setting-note">应用或清除会停止当前轮次，保留对话记录。仅有文本能力的平台可用于 LLM，STT/TTS 请填写支持对应音频接口的服务；TTS 失败时仍可阅读字幕。</p>
  </details>;
}
