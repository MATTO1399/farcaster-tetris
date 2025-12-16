'use client';

import React from 'react';
import Image from 'next/image';

interface GameMenuProps {
  onStartGame: () => void;
  onShowHistory: () => void;
  onShowRanking: () => void;
  username?: string;
  pfpUrl?: string;
}

const GameMenu: React.FC<GameMenuProps> = ({
  onStartGame,
  onShowHistory,
  onShowRanking,
  username,
  pfpUrl,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center w-full min-h-[100dvh] bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 p-6"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* ユーザー情報（右上） */}
      {username && (
        <div className="absolute top-6 right-6 flex items-center gap-2 bg-purple-600 rounded-full px-4 py-2">
          {pfpUrl && (
            <Image
              src={pfpUrl}
              alt={username}
              width={24}
              height={24}
              className="rounded-full"
            />
          )}
          <span className="text-white text-sm font-semibold">@{username}</span>
        </div>
      )}

      {/* ロゴ/おじゃまブロック */}
      <div className="mb-8">
        <div className="relative w-32 h-32">
          <Image
            src="/ojama-block.png"
            alt="FARTETRIS"
            fill
            style={{ objectFit: 'contain' }}
            unoptimized
          />
        </div>
      </div>

      {/* タイトル */}
      <h1
        className="text-5xl font-black text-center mb-2"
        style={{
          background: 'linear-gradient(to right, #fbbf24, #f59e0b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 4px 20px rgba(251, 191, 36, 0.5)',
        }}
      >
        FARTETRIS
      </h1>
      
      <p className="text-white text-center mb-12 text-lg">
        Stack & Clear!
      </p>

      {/* メインボタン */}
      <button
        onClick={onStartGame}
        className="w-full max-w-sm py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xl font-bold rounded-full shadow-lg transition-all transform hover:scale-105 mb-6"
      >
        START PLAYING
      </button>

      {/* サブボタン */}
      <div className="flex gap-4 w-full max-w-sm">
        <button
          onClick={onShowHistory}
          className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-full transition-colors flex items-center justify-center gap-2"
        >
          <span>🕐</span>
          <span>HISTORY</span>
        </button>
        
        <button
          onClick={onShowRanking}
          className="flex-1 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-semibold rounded-full transition-colors flex items-center justify-center gap-2"
        >
          <span>🏆</span>
          <span>RANKING</span>
        </button>
      </div>
    </div>
  );
};

export default GameMenu;
