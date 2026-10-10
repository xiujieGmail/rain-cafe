import type { Metadata } from 'next';
import { assetPath } from '@/lib/preview';
import './globals.css';
export const metadata: Metadata = {
  title: '雨隙 · 雨夜咖啡馆',
  icons: { icon: assetPath('/icon.svg') },
  description: '雨停之前，坐一会儿。与旅行摄影师 Mira 的一段可打断的语音互动。',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
