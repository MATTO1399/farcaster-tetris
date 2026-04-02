'use client';

import dynamic from 'next/dynamic';

// クライアントサイドでのみレンダリング
const TetrisGame = dynamic(() => import('../components/Game/TetrisGame'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900">
      <div className="text-white text-2xl">Loading Tetris...</div>
    </div>
  ),
});

export default function Home() {
  const handleGameOver = (score: number) => {
    console.log('Game Over! Final Score:', score);
  };

  return (
    <main>
      <TetrisGame onGameOver={handleGameOver} />
    </main>
  );
}
