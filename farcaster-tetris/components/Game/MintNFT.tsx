'use client';

import React, { useState, useEffect } from 'react';
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi';

const FIRST_PLAY_NFT_ABI = [
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'hasClaimed',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const TARGET_CHAIN_ID = 84532; // Base Sepolia

type Props = {
  score: number;
  onMinted?: (tokenId: number) => void;
};

export default function MintNFT({ score, onMinted }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  // コントラクトから hasClaimed を取得
  // ウォレット未接続時は query を無効化（enabled: false）
  const { data: hasClaimed } = useReadContract({
    address: process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`,
    abi: FIRST_PLAY_NFT_ABI,
    functionName: 'hasClaimed',
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: {
      enabled: Boolean(address),
    },
  });

  useEffect(() => {
    if (isSuccess && txHash) {
      setStatus('ミント完了！🎉');
      if (onMinted) onMinted(1);
    }
  }, [isSuccess, txHash, onMinted]);

  const handleMint = async () => {
    setError(null);
    setStatus('');

    if (!isConnected || !address) {
      setError('ウォレットを接続してください');
      return;
    }

    if (hasClaimed) {
      setError('このウォレットはミント済みです');
      return;
    }

    // ネットワーク切替
    if (chainId !== TARGET_CHAIN_ID) {
      setStatus('Base Sepolia に切替中...');
      try {
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      } catch (e) {
        setError('ネットワーク切替に失敗。');
        return;
      }
    }

    // 署名取得
    setStatus('署名を取得中...');
    let data;
    try {
      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, score }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      data = await res.json();
    } catch (e: any) {
      setError('署名取得失敗: ' + (e?.message ?? e));
      return;
    }

    // claim送信
    setStatus('トランザクション送信中...');
    try {
      writeContract({
        address: data.contractAddress as `0x${string}`,
        abi: FIRST_PLAY_NFT_ABI,
        functionName: 'claim',
        args: [
          data.message.to,
          BigInt(data.message.deadline),
          BigInt(data.message.nonce),
          data.signature as `0x${string}`,
        ],
        chainId: TARGET_CHAIN_ID,
      });
    } catch (e: any) {
      setError('送信失敗: ' + (e?.message ?? e));
    }
  };

  // ★ ミント済みなら別の表示に切替
  if (hasClaimed) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-green-400 font-bold">
          ✓ First_NFT ミント済み 🎉
        </p>
        <a
          href={`https://sepolia.basescan.org/token/${process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS}?a=${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-300 underline"
        >
          BaseScanで見る
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleMint}
        disabled={!isConnected || isPending || isConfirming}
        className="px-6 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50"
      >
        {isPending || isConfirming ? '処理中...' : 'First_NFT をGET!'}
      </button>
      {status && <p className="text-sm text-gray-300">{status}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {isSuccess && txHash && (
        <a
          href={`https://sepolia.basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-300 underline"
        >
          トランザクションを見る
        </a>
      )}
    </div>
  );
}
