'use client';

import React, { useState, useEffect } from 'react';
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
} from 'wagmi';

const TIER = {
  BRONZE: 0,
  SILVER: 1,
  GOLD: 2,
  PLATINUM: 3
} as const;

const TIER_INFO = [
  { name: 'Bronze', minScore: 100, color: 'bg-amber-700' },
  { name: 'Silver', minScore: 500, color: 'bg-gray-400' },
  { name: 'Gold', minScore: 1000, color: 'bg-yellow-500' },
  { name: 'Platinum', minScore: 3000, color: 'bg-cyan-300' }
];

function getTierForScore(score: number): number {
  if (score >= 3000) return TIER.PLATINUM;
  if (score >= 1000) return TIER.GOLD;
  if (score >= 500) return TIER.SILVER;
  if (score >= 100) return TIER.BRONZE;
  return -1;
}

const TETRIS_TIER_ABI = [
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tier', type: 'uint8' },
      { name: 'deadline', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' }
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'minted',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'uint8' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

const TARGET_CHAIN_ID = 84532; // Base Sepolia

type Props = {
  score: number;
  onMinted?: (tokenId: number) => void;
};

export default function MintTetrisNFT({ score, onMinted }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash
  });

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [busyTier, setBusyTier] = useState<number | null>(null);

  const contractAddress = process.env.NEXT_PUBLIC_TETRIS_TIER_NFT_ADDRESS as `0x${string}` | undefined;

  // 4Tier × minted を並列取得
  const { data: mintedResults } = useReadContracts({
    contracts: address && contractAddress
      ? [0, 1, 2, 3].map(tier => ({
          address: contractAddress,
          abi: TETRIS_TIER_ABI,
          functionName: 'minted',
          args: [address, tier]
        }))
      : [],
    query: { enabled: Boolean(address && contractAddress) }
  });

  const mintedState: Record<number, boolean> = {};
  if (mintedResults) {
    mintedResults.forEach((res, i) => {
      mintedState[i] = Boolean(res.result);
    });
  } else {
    [0, 1, 2, 3].forEach(i => { mintedState[i] = false; });
  }

  useEffect(() => {
    if (isSuccess && txHash) {
      setStatus('ミント完了！🎉');
      if (onMinted) onMinted(1);
    }
  }, [isSuccess, txHash, onMinted]);

  const handleMint = async (tierId: number) => {
    setError(null);
    setStatus('');
    setBusyTier(tierId);

    if (!isConnected || !address) {
      setError('ウォレットを接続してください');
      setBusyTier(null);
      return;
    }
    if (!contractAddress) {
      setError('コントラクトアドレス未設定');
      setBusyTier(null);
      return;
    }
    if (mintedState[tierId]) {
      setError('このTierはミント済みです');
      setBusyTier(null);
      return;
    }

    // ネットワーク切替
    if (chainId !== TARGET_CHAIN_ID) {
      setStatus('Base Sepolia に切替中...');
      try {
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      } catch {
        setError('ネットワーク切替に失敗');
        setBusyTier(null);
        return;
      }
    }

    // 署名取得
    setStatus('署名を取得中...');
    let data;
    try {
      const res = await fetch('/api/nft/tier-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, score })
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      data = await res.json();
      
      // サーバーから返ってきた tier (might differ from requested)
      const serverTier = data.tier;
      if (serverTier !== tierId) {
        throw new Error(`サーバー判定Tier=${serverTier} が不一致`);
      }
    } catch (e: any) {
      setError('署名取得失敗: ' + (e?.message ?? e));
      setBusyTier(null);
      return;
    }

    // claim送信
    setStatus('トランザクション送信中...');
    try {
      writeContract({
        address: contractAddress,
        abi: TETRIS_TIER_ABI,
        functionName: 'claim',
        args: [
          data.message.to,
          data.message.tier,
          BigInt(data.message.deadline),
          BigInt(data.message.nonce),
          data.signature as `0x${string}`
        ],
        chainId: TARGET_CHAIN_ID
      });
    } catch (e: any) {
      setError('送信失敗: ' + (e?.message ?? e));
      setBusyTier(null);
    }
  };

  // 対象Tier計算
  const eligibleTier = getTierForScore(score);
  
  if (eligibleTier < 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-gray-400">スコア {score}点。次のTierまであと少し!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Tier ボタン表示 (対象Tier ごとに) */}
      <div className="flex flex-wrap gap-2 justify-center">
        {TIER_INFO.map((info, tierId) => {
          const canClaim = tierId === eligibleTier && !mintedState[tierId];
          const alreadyMinted = mintedState[tierId];
          const isUnlocked = tierId <= eligibleTier;
          const isBusy = busyTier === tierId && (isPending || isConfirming);

          if (alreadyMinted) {
            return (
              <div
                key={tierId}
                className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg"
              >
                ✓ {info.name}
              </div>
            );
          }

          if (!isUnlocked) {
            return (
              <div
                key={tierId}
                className="px-4 py-2 bg-gray-700 text-gray-400 text-sm rounded-lg cursor-not-allowed"
                title={`${info.minScore}点以上でアンロック`}
              >
                🔒 {info.name} ({info.minScore}+)
              </div>
            );
          }

          return (
            <button
              key={tierId}
              onClick={() => handleMint(tierId)}
              disabled={!isConnected || isBusy || !canClaim}
              className={`px-4 py-2 ${info.color} text-black font-bold rounded-lg hover:opacity-80 disabled:opacity-50`}
            >
              {isBusy ? '処理中...' : `${info.name} NFT をGET!`}
            </button>
          );
        })}
      </div>

      {status && <p className="text-sm text-gray-300">{status}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {isSuccess && txHash && (
        <a
          href={`https://sepolia.basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-300 underline"
        >
          BaseScanで見る
        </a>
      )}
    </div>
  );
}
