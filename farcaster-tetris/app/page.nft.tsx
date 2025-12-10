'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { TetrisNFT_ABI } from '@/utils/abis/TetrisNFT';
import { NFT_THRESHOLD_SCORE } from '@/utils/constants';

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
  const [showMintModal, setShowMintModal] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContract, data: hash, error: mintError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // NFTコントラクトアドレス
  const NFT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as `0x${string}`;

  const handleGameOver = (score: number) => {
    setFinalScore(score);
    console.log('Game Over! Final Score:', score);

    // ハイスコア達成時にミントモーダルを表示
    if (score >= NFT_THRESHOLD_SCORE) {
      setShowMintModal(true);
    }
  };

  // NFTミント処理
  const handleMintNFT = async () => {
    if (!isConnected) {
      // ウォレット接続
      const connector = connectors[0];
      if (connector) {
        connect({ connector });
      }
      return;
    }

    if (!NFT_CONTRACT_ADDRESS) {
      alert('NFTコントラクトが設定されていません。環境変数を確認してください。');
      return;
    }

    if (!finalScore || finalScore < NFT_THRESHOLD_SCORE) {
      alert('スコアが足りません');
      return;
    }

    try {
      setIsMinting(true);

      // メタデータURIを生成（実際にはIPFSなどにアップロード）
      const tokenURI = generateTokenURI(finalScore);

      // NFTミント
      writeContract({
        address: NFT_CONTRACT_ADDRESS,
        abi: TetrisNFT_ABI,
        functionName: 'mint',
        args: [address!, BigInt(finalScore), tokenURI],
      });
    } catch (error) {
      console.error('Mint error:', error);
      alert('ミントに失敗しました');
      setIsMinting(false);
    }
  };

  // トークンURIの生成（簡易版）
  const generateTokenURI = (score: number): string => {
    const metadata = {
      name: `Tetris Champion #${score}`,
      description: `Tetrisで${score}点を達成した証明NFT`,
      image: `${process.env.NEXT_PUBLIC_APP_URL}/nft/${score}.png`,
      attributes: [
        {
          trait_type: 'Score',
          value: score,
        },
        {
          trait_type: 'Achievement',
          value: score >= 5000 ? 'Master' : score >= 2000 ? 'Expert' : 'Champion',
        },
        {
          trait_type: 'Date',
          value: new Date().toISOString(),
        },
      ],
    };

    // Base64エンコード（実際にはIPFSを推奨）
    return `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;
  };

  // ミント成功時の処理
  const handleMintSuccess = () => {
    setShowMintModal(false);
    setIsMinting(false);
    alert('NFTのミントに成功しました！🎉');
  };

  return (
    <main>
      <TetrisGame onGameOver={handleGameOver} />

      {/* NFTミントモーダル */}
      {showMintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-indigo-900 p-8 rounded-2xl shadow-2xl max-w-md w-full border-4 border-yellow-400">
            <div className="text-center">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-3xl font-bold text-yellow-400 mb-2">
                おめでとうございます！
              </h2>
              <p className="text-white text-xl mb-4">
                スコア: {finalScore}点
              </p>
              <p className="text-gray-300 mb-6">
                ハイスコア達成！記念NFTをミントできます
              </p>

              {/* ウォレット接続状態 */}
              {!isConnected ? (
                <div className="mb-6">
                  <p className="text-sm text-gray-400 mb-4">
                    NFTをミントするにはウォレットを接続してください
                  </p>
                  <button
                    onClick={handleMintNFT}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
                  >
                    ウォレットを接続
                  </button>
                </div>
              ) : (
                <div className="mb-6">
                  <p className="text-sm text-green-400 mb-2">
                    ✅ ウォレット接続済み
                  </p>
                  <p className="text-xs text-gray-400 break-all">
                    {address}
                  </p>
                </div>
              )}

              {/* ミントボタン */}
              {isConnected && (
                <>
                  {isConfirming && (
                    <div className="mb-4 text-yellow-400">
                      トランザクション確認中...
                    </div>
                  )}
                  
                  {isConfirmed && (
                    <div className="mb-4 text-green-400">
                      ミント成功！🎉
                    </div>
                  )}

                  {mintError && (
                    <div className="mb-4 text-red-400 text-sm">
                      エラー: {mintError.message}
                    </div>
                  )}

                  <button
                    onClick={handleMintNFT}
                    disabled={isMinting || isConfirming || isConfirmed}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                  >
                    {isMinting || isConfirming
                      ? 'ミント中...'
                      : isConfirmed
                      ? 'ミント完了✓'
                      : 'NFTをミント'}
                  </button>
                </>
              )}

              {/* 閉じるボタン */}
              <button
                onClick={() => {
                  setShowMintModal(false);
                  if (isConfirmed) handleMintSuccess();
                }}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                {isConfirmed ? '閉じる' : '後で'}
              </button>

              {/* 注意事項 */}
              <p className="text-xs text-gray-500 mt-4">
                ※ Base Sepoliaテストネット上でミントされます
              </p>
            </div>
          </div>
        </div>
      )}

      {/* デバッグ用 */}
      {process.env.NODE_ENV === 'development' && finalScore !== null && (
        <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg">
          <p>最終スコア: {finalScore}</p>
          <p className="text-xs text-gray-400 mt-1">
            しきい値: {NFT_THRESHOLD_SCORE}
          </p>
          {isConnected && (
            <p className="text-xs text-green-400 mt-1">
              Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
