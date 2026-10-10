'use client';
import { assetPath } from '@/lib/preview';
import { X, ImageOff } from 'lucide-react';
import { CharacterCanvas } from './character-canvas';
import { useSceneStore } from '@/stores/scene-store';

export function SceneStage() {
  const phase = useSceneStore(state => state.phase);
  const emotion = useSceneStore(state => state.emotion);
  const action = useSceneStore(state => state.action);
  const scene = useSceneStore(state => state.scene);
  const media = useSceneStore(state => state.media);
  const mediaFailed = useSceneStore(state => state.mediaFailed);
  return <div className={`scene scene-${scene}`} data-testid="scene" data-scene={scene}>
    <div className="scene-background" style={{ backgroundImage: `url("${assetPath('/scenes/cafe.svg')}")` }} />
    <div className="scene-light" />
    <div className="rain" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <i key={i} style={{ left: `${18 + (i * 17) % 66}%`, animationDelay: `${i * -.37}s`, animationDuration: `${1.3 + (i % 4) * .3}s` }} />)}</div>
    <div className="window-caption" aria-hidden="true">{scene === 'clear' ? '雨停了。夜晚还很长。' : '一场雨，一次偶然的停留。'}</div>
    <div className="scene-vignette" />
    <CharacterCanvas phase={phase} emotion={emotion} action={action} />
    <div className="foreground" aria-hidden="true"><span className="cup"><i /></span><span className="table-line" /></div>
    {media ? <figure className="travel-photo" data-testid="travel-photo">
      <button className="photo-close" onClick={() => useSceneStore.getState().patch({ media: false })} aria-label="收起照片"><X size={16} /></button>
      <img src={assetPath('/scenes/travel.svg')} alt="Mira 分享的旅途照片：夕阳下的海边车站和驶离的列车" onError={() => useSceneStore.getState().patch({ media: false, mediaFailed: true, notice: '照片暂时无法加载，角色仍可继续交流。' })} />
      <figcaption>最后一站，海边。<small>MIRA’S FIELD NOTES · 024</small></figcaption>
    </figure> : null}
    {mediaFailed ? <div className="media-fallback" role="status"><ImageOff size={18} /><span>照片未能打开<small>这个故事，我们可以继续聊。</small></span></div> : null}
  </div>;
}
