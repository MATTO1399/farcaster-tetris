'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

type LeaderboardEntry = {
  address?: string;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  score: number;
  level: number;
  lines: number;
  timestamp: number;
};

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserAddress?: string;
}

function formatAddress(address?: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeTopScores(data: unknown): LeaderboardEntry[] {
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is LeaderboardEntry =>
        !!item && typeof item === 'object' && typeof (item as any).score === 'number'
    );
  }

  if (data && typeof data === 'object') {
    if (Array.isArray((data as any).topScores)) {
      return (data as any).topScores.filter(
        (item: unknown): item is LeaderboardEntry =>
          !!item && typeof item === 'object' && typeof (item as any).score === 'number'
      );
    }

    if (Array.isArray((data as any).entries)) {
      return (data as any).entries.filter(
        (item: unknown): item is LeaderboardEntry =>
          !!item && typeof item === 'object' && typeof (item as any).score === 'number'
      );
    }
  }

  return [];
}

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUserAddress,
}) => {
  const [topScores, setTopScores] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userHighScore, setUserHighScore] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen, currentUserAddress]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch('/api/leaderboard', { cache: 'no-store' });
      const data = await response.json();
      setTopScores(normalizeTopScores(data));

      if (currentUserAddress) {
        const userResponse = await fetch(
          `/api/leaderboard?address=${encodeURIComponent(currentUserAddress.toLowerCase())}`,
          { cache: 'no-store' }
        );
        const userData = await userResponse.json();

        if (userData && typeof userData === 'object') {
          setUserRank(typeof userData.rank === 'number' ? userData.rank : null);
          setUserHighScore(
            userData.highScore && typeof userData.highScore === 'object'
              ? userData.highScore
              : null
          );
        } else {
          setUserRank(null);
          setUserHighScore(null);
        }
      } else {
        setUserRank(null);
        setUserHighScore(null);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      setTopScores([]);
      setUserRank(null);
      setUserHighScore(null);
      setLoadError('ランキングを取得できませんでした');
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

        {userHighScore && (
          <div className="p-4 bg-purple-900/50 border-b border-purple-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {userHighScore.pfpUrl ? (
                  <Image
                    src={userHighScore.pfpUrl}
                    alt={userHighScore.displayName || userHighScore.username || 'user'}
                    width={40}
                    height={40}
                    className="rounded-full"
                    unoptimized
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(
                      userHighScore.displayName ||
                      userHighScore.username ||
                      formatAddress(userHighScore.address) ||
                      '?'
                    )
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="text-white font-bold truncate">
                    {userHighScore.displayName ||
                      userHighScore.username ||
                      formatAddress(userHighScore.address)}
                  </p>
                  <p className="text-purple-300 text-sm">
                    Your Best: {userHighScore.score}
                  </p>
                </div>
              </div>

              {typeof userRank === 'number' && (
                <div className="text-yellow-400 font-bold text-lg">#{userRank}</div>
              )}
            </div>
          </div>
        )}

        <div className="p-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center text-white py-8">Loading...</div>
          ) : loadError ? (
            <div className="text-center text-red-300 py-8">{loadError}</div>
          ) : topScores.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No scores yet. Be the first!
            </div>
          ) : (
            <div className="space-y-2">
              {topScores.map((entry, index) => (
                <div
                  key={`${entry.address || entry.username || 'entry'}-${entry.timestamp}-${index}`}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    index < 3
                      ? 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/30'
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="w-8 text-center shrink-0">
                    {index === 0 && <span className="text-2xl">🥇</span>}
                    {index === 1 && <span className="text-2xl">🥈</span>}
                    {index === 2 && <span className="text-2xl">🥉</span>}
                    {index >= 3 && <span className="text-white font-bold">#{index + 1}</span>}
                  </div>

                  {entry.pfpUrl ? (
                    <Image
                      src={entry.pfpUrl}
                      alt={entry.displayName || entry.username || 'user'}
                      width={40}
                      height={40}
                      className="rounded-full shrink-0"
                      unoptimized
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {(
                        entry.displayName ||
                        entry.username ||
                        formatAddress(entry.address) ||
                        '?'
                      )
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">
                      {entry.displayName ||
                        entry.username ||
                        formatAddress(entry.address)}
                    </p>
                    <p className="text-gray-400 text-xs truncate">
                      {entry.address
                        ? formatAddress(entry.address)
                        : entry.username
                        ? `@${entry.username}`
                        : 'player'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
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
