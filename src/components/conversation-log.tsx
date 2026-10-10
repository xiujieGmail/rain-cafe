'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Typewriter } from './typewriter';
import type { DialogueEntry } from '@/stores/scene-store';

const statusLabels = { pending: '进行中', complete: '完成', interrupted: '已打断', failed: '回复失败' };

export function ConversationLog({ entries, turnId, phase, subtitle }: {
  entries: DialogueEntry[];
  turnId: number;
  phase: 'idle' | 'listening' | 'thinking' | 'speaking';
  subtitle: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const latestReply = entries.findLast(entry => entry.role === 'assistant' && entry.turnId === turnId);

  function followLatest() {
    followingRef.current = true;
    setShowLatest(false);
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }

  useEffect(() => {
    // 用户主动开始新轮时回到最新消息；查看旧记录本身不会改变对话或轮次。
    followLatest();
  }, [turnId]);

  useEffect(() => {
    // 打字机导致内容增高时，仅在用户仍跟随底部的情况下滚动，避免抢走阅读位置。
    const observer = new ResizeObserver(() => {
      if (followingRef.current) followLatest();
    });
    if (contentRef.current) observer.observe(contentRef.current);
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  return <div className="conversation-log">
    <div ref={viewportRef} className="conversation-scroll" role="region" aria-label="对话消息，可滚动查看历史" tabIndex={0} onScroll={() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 28;
      followingRef.current = atBottom;
      setShowLatest(!atBottom);
    }}>
      <div ref={contentRef} className="conversation-messages">
        {!entries.length ? <div className="subtitle-area"><span className="speaker-label">MIRA</span><p data-testid="subtitle">{subtitle || '你可以继续这个故事。'}</p></div> : entries.map(entry => <article key={entry.id} className={`history-entry history-${entry.role}`}>
          <header><strong>{entry.role === 'user' ? '你' : 'Mira'}</strong><time>{entry.time}</time>{entry.status === 'interrupted' || entry.status === 'failed' ? <small>{statusLabels[entry.status]}</small> : null}</header>
          <p data-testid={entry.id === latestReply?.id ? 'subtitle' : undefined}>{entry.id === latestReply?.id && entry.status !== 'interrupted' ? <Typewriter text={entry.text} /> : entry.text}</p>
        </article>)}
        {phase === 'listening' || (phase === 'thinking' && !latestReply) ? <p className="conversation-pending" role="status">{phase === 'listening' ? 'Mira 正在听你说…' : 'Mira 正在想怎么回答…'}</p> : null}
      </div>
    </div>
    {entries.length > 2 && !showLatest ? <span className="conversation-scroll-hint" aria-hidden="true">向上滚动回看</span> : null}
    {showLatest ? <button className="latest-message" onClick={followLatest}>回到最新消息<ChevronDown size={13} /></button> : null}
  </div>;
}
