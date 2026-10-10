'use client';
import { useEffect, useState } from 'react';

export function Typewriter({ text }: { text: string }) {
  const [visible, setVisible] = useState('');
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVisible(text); return; }
    const characters = Array.from(text);
    let count = 0;
    setVisible('');
    // 文本替换或轮次取消时清除旧计时器，禁止旧字幕继续输出；按字符点避免拆开表情。
    const timer = setInterval(() => {
      count++; setVisible(characters.slice(0, count).join(''));
      if (count >= characters.length) clearInterval(timer);
    }, 32);
    return () => clearInterval(timer);
  }, [text]);
  return <><span aria-hidden="true" data-testid="typewriter">{visible}<span className={visible.length < text.length ? 'typing-cursor' : 'typing-cursor done'}>▍</span></span><span className="sr-only">{text}</span></>;
}
