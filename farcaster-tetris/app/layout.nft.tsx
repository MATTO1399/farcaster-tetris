import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'FARTETRIS - Farcaster Mini App',
  description: 'Classic Tetris game as a Farcaster Mini App with NFT rewards',
  openGraph: {
    title: 'FARTETRIS - Farcaster Mini App',
    description: 'Play Tetris and earn NFT rewards for high scores!',
    images: ['/icon.png'],
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': '/splash.png',
    'fc:frame:button:1': 'Play Tetris',
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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
