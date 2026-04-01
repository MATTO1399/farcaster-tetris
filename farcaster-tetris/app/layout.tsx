import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'FARTETRIS',
  description: 'Play FARTETRIS on Base App',
  openGraph: {
    title: 'FARTETRIS',
    description: 'Play FARTETRIS on Base App',
    images: ['/icon.png'],
  },
  other: {
    'base:app_id': '693e193fd19763ca26ddc2a4',
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
