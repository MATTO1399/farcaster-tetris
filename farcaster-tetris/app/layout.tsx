import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FARTETRIS',
  description: 'Play FARTETRIS on Farcaster',
  openGraph: {
    title: 'FARTETRIS',
    description: 'Play FARTETRIS on Farcaster',
    images: ['/icon.png'],
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': '/splash.png',
    'fc:frame:button:1': 'Play FARTETRIS',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}