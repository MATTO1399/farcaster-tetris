'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

// クライアントサイドでのみレンダリング
const TetrisGame = dynamic(() => import('@/components/Game/TetrisGame'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900">
      <div className="text-white text-2xl">Loading Tetris...</div>
    </div>
  ),
});

export default function Home() {
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const handleGameOver = (score: number) => {
    setFinalScore(score);
    console.log('Game Over! Final Score:', score);
    // ここでNFTミント処理やスコアの送信を実装できます
  };

  return (
    <main>
      <TetrisGame onGameOver={handleGameOver} />
      
      {/* デバッグ用 - 本番環境では削除 */}
      {process.env.NODE_ENV === 'development' && finalScore !== null && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg">
          <p>最終スコア: {finalScore}</p>
        </div>
      )}
    </main>
  );
}
