export type AudioInspection = { duration: number; peak: number; rms: number; silent: boolean; quiet: boolean };

export function inspectSamples(samples: Float32Array, sampleRate: number): AudioInspection {
  let peak = 0, energy = 0;
  for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
  const rms = Math.sqrt(energy / Math.max(1, samples.length));
  // 只阻止接近数字静音的录音，低音量语音保留给识别服务，避免误拒绝轻声说话。
  return { duration: samples.length / sampleRate, peak, rms, silent: peak < 0.00001, quiet: rms < 0.003 };
}

export function encodeMonoWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const label = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  label(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); label(8, 'WAVE');
  label(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  label(36, 'data'); view.setUint32(40, samples.length * 2, true);
  // 编码成通用单声道 PCM，减少 WebM / MP4 编码差异对语音服务的影响。
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function prepareRecording(blob: Blob): Promise<{ blob: Blob; inspection: AudioInspection }> {
  const decoder = new AudioContext();
  try {
    const decoded = await decoder.decodeAudioData(await blob.arrayBuffer());
    // 浏览器本地解码与重采样；原始音频及回放均不写入磁盘。
    const renderer = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * 16000)), 16000);
    const source = renderer.createBufferSource(); source.buffer = decoded; source.connect(renderer.destination); source.start();
    const rendered = await renderer.startRendering();
    const samples = rendered.getChannelData(0);
    return { blob: encodeMonoWav(samples, 16000), inspection: inspectSamples(samples, 16000) };
  } finally { await decoder.close().catch(() => {}); }
}
