'use client';
import { assetPath } from '@/lib/preview';
import { useEffect, useRef, useState } from 'react';
import type { Action, Emotion, Phase } from '@/lib/protocol';

const emotions: Emotion[] = ['calm', 'guarded', 'warm', 'wistful'];
const actions: Action[] = ['idle', 'look_window', 'show_camera'];
export function CharacterCanvas({ phase, emotion, action }: { phase: Phase; emotion: Emotion; action: Action }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 动画循环读取最新状态，表情切换时无需重新加载图集或重建循环。
  const stateRef = useRef({ phase, emotion, action });
  const [failed, setFailed] = useState(false);
  useEffect(() => { stateRef.current = { phase, emotion, action }; }, [phase, emotion, action]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) { setFailed(true); return; }
    const atlas = new Image();
    let frame = 0, disposed = false, lastDraw = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (time: number) => {
      if (disposed) return;
      if (time - lastDraw > 40) {
        lastDraw = time;
        const state = stateRef.current;
        const blink = !reduced && time % 4300 > 4120 ? 1 : 0;
        const mouth = state.phase === 'speaking' && Math.floor(time / 160) % 3 !== 0 ? 1 : 0;
        // 图集顺序与生成脚本一致：情绪、动作、嘴形、眼形依次组合成帧索引。
        const index = (((emotions.indexOf(state.emotion) * 3 + actions.indexOf(state.action)) * 2 + mouth) * 2 + blink);
        const breath = reduced ? 0 : Math.sin(time / 950) * 2;
        ctx.clearRect(0, 0, 500, 700);
        ctx.save();
        ctx.translate(state.action === 'look_window' ? -4 : 0, breath);
        ctx.drawImage(atlas, (index % 8) * 500, Math.floor(index / 8) * 700, 500, 700, 0, 0, 500, 700);
        ctx.restore();
      }
      frame = requestAnimationFrame(draw);
    };
    atlas.onload = () => { if (!disposed) frame = requestAnimationFrame(draw); };
    atlas.onerror = () => { if (!disposed) setFailed(true); };
    atlas.src = assetPath('/character/mira-atlas.webp');
    // 卸载时停止绘制并解除图片回调，防止迟到加载启动新的动画循环。
    return () => { disposed = true; cancelAnimationFrame(frame); atlas.onload = null; atlas.onerror = null; };
  }, []);
  return <div className={`character character-${phase}`} role="img" aria-label={`Mira，26岁旅行摄影师。${emotion === 'warm' ? '微笑' : emotion === 'guarded' ? '警惕' : emotion === 'wistful' ? '怀念' : '平静'}，${action === 'show_camera' ? '举起相机' : action === 'look_window' ? '望向窗外' : '坐在桌边'}`}>
    {failed ? <><img src={assetPath('/character/mira.svg')} alt="Mira 的静态降级画面" /><span className="asset-fallback">角色动画加载失败，已显示静态角色</span></> : <canvas ref={canvasRef} width={500} height={700} />}
  </div>;
}
