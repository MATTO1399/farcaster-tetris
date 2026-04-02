'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import type { HistoryEntry } from '../../lib/history';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserAddress?: string;
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  currentUserAddress,
}) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    const resolveAddress = async () => {
      setErrorMessage('');

      if (currentUserAddress) {
        setResolvedAddress(currentUserAddress.toLowerCase());
        return;
      }

      try {
        const response = await fetch('/api/siwe/me', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          setResolvedAddress(null);
          return;
        }

        const data = await response.json();
        if (data?.authenticated && typeof data?.address === 'string') {
          setResolvedAddress(data.address.toLowerCase());
        } else {
          setResolvedAddress(null);
        }
      } catch (error) {
        console.error('Failed to resolve session address:', error);
        setResolvedAddress(null);
      }
    };

    void resolveAddress();
  }, [isOpen, currentUserAddress]);

  useEffect(() => {
    if (!isOpen) return;

    if (!resolvedAddress) {
      setHistory([]);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(
          `/api/history?address=${encodeURIComponent(resolvedAddress)}`,
          {
            method: 'GET',
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          const text = await response.text();
          setErrorMessage(text || '履歴の取得に失敗しました');
          setHistory([]);
          return;
        }

        const data = await response.json();
        setHistory(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch history:', error);
        setErrorMessage('履歴の取得に失敗しました');
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchHistory();
  }, [isOpen, resolvedAddress]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes}分前`;
    } else if (diffInHours < 24) {
      return `${diffInHours}時間前`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}日前`;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-gray-900 to-purple-900 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl border-2 border-purple-400/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">プレイ履歴</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold transition-colors"
          >
            ×
          </button>
        </div>

        {!resolvedAddress ? (
          <div className="text-center py-8">
            <div className="text-gray-300">ウォレット接続後の履歴を表示します</div>
          </div>
        ) : loading ? (
          <div className="text-center py-8">
            <div className="text-purple-300">読み込み中...</div>
          </div>
        ) : errorMessage ? (
          <div className="text-center py-8">
            <div className="text-red-300 whitespace-pre-wrap break-all">{errorMessage}</div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400">まだプレイ履歴がありません</div>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((entry, index) => {
              const label = entry.displayName || entry.username || entry.address;
              return (
                <div
                  key={`${entry.timestamp}-${index}`}
                  className="bg-black/40 backdrop-blur-sm rounded-lg p-4 border border-purple-400/20 hover:border-purple-400/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {entry.pfpUrl ? (
                        <Image
                          src={entry.pfpUrl}
                          alt={label}
                          width={40}
                          height={40}
                          className="rounded-full"
                          unoptimized
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                          {label[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-white font-semibold break-all">{label}</div>
                        <div className="text-xs text-gray-400">{formatDate(entry.timestamp)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="bg-purple-600/20 rounded-lg p-2 text-center">
                      <div className="text-xs text-purple-300">スコア</div>
                      <div className="text-lg font-bold text-white">
                        {entry.score.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-blue-600/20 rounded-lg p-2 text-center">
                      <div className="text-xs text-blue-300">レベル</div>
                      <div className="text-lg font-bold text-white">{entry.level}</div>
                    </div>
                    <div className="bg-green-600/20 rounded-lg p-2 text-center">
                      <div className="text-xs text-green-300">ライン</div>
                      <div className="text-lg font-bold text-white">{entry.lines}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryModal;
