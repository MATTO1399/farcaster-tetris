'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import type { LeaderboardEntry } from '@/lib/leaderboard';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserFid?: number;
}

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose, currentUserFid }) => {
  const [topScores, setTopScores] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userHighScore, setUserHighScore] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen, currentUserFid]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // トップ10取得
      const response = await fetch('/api/leaderboard');
      const data = await response.json();
      setTopScores(data);

      // 自分のランク取得
      if (currentUserFid) {
        const userResponse = await fetch(`/api/leaderboard?fid=${currentUserFid}`);
        const userData = await userResponse.json();
        setUserRank(userData.rank);
        setUserHighScore(userData.highScore);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <div
        className="relative w-full max-w-md mx-4 bg-gradient-to-b from-gray-900 to-black rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="relative p-6 bg-gradient-to-r from-yellow-600 to-orange-600">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white text-2xl font-bold hover:text-gray-200"
          >
            ✕
          </button>
          <div className="flex items-center gap-3">
            <div className="text-4xl">🏆</div>
            <h2 className="text-2xl font-bold text-white">RANKING</h2>
          </div>
        </div>

        {/* 自分のスコア */}
        {userHighScore && (
          <div className="p-4 bg-purple-900/50 border-b border-purple-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {userHighScore.pfpUrl && (
                  <Image
                    src={userHighScore.pfpUrl}
                    alt={userHighScore.username}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                )}
                <div>
                  <p className="text-white font-bold">{userHighScore.displayName || userHighScore.username}</p>
                  <p className="text-purple-300 text-sm">Your Best: {userHighScore.score}</p>
                </div>
              </div>
              {userRank && (
                <div className="text-yellow-400 font-bold text-lg">
                  #{userRank}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ランキングリスト */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center text-white py-8">Loading...</div>
          ) : topScores.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No scores yet. Be the first!</div>
          ) : (
            <div className="space-y-2">
              {topScores.map((entry, index) => (
                <div
                  key={entry.fid}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    index < 3
                      ? 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/30'
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                  }`}
                >
                  {/* ランク */}
                  <div className="w-8 text-center">
                    {index === 0 && <span className="text-2xl">🥇</span>}
                    {index === 1 && <span className="text-2xl">🥈</span>}
                    {index === 2 && <span className="text-2xl">🥉</span>}
                    {index >= 3 && <span className="text-white font-bold">#{index + 1}</span>}
                  </div>

                  {/* プロフィール画像 */}
                  {entry.pfpUrl && (
                    <Image
                      src={entry.pfpUrl}
                      alt={entry.username}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  )}

                  {/* ユーザー情報 */}
                  <div className="flex-1">
                    <p className="text-white font-semibold">{entry.displayName || entry.username}</p>
                    <p className="text-gray-400 text-xs">@{entry.username}</p>
                  </div>

                  {/* スコア */}
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold text-lg">{entry.score}</p>
                    <p className="text-gray-400 text-xs">Lv.{entry.level}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardModal;
