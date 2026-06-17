'use client';

import React, { useState, useEffect } from 'react';
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
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
    outputs: [
      { name: 'tokenId', type: 'uint256' },
    ],
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

    // ステップ1: Base Sepolia に切替
    if (chainId !== TARGET_CHAIN_ID) {
      setStatus('Base Sepolia に切替中...');
      try {
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
        // 切替成功 → ユーザーは次の処理に進む
      } catch (e) {
        setError('ネットワーク切替に失敗。RabbyでBase Sepoliaを手動選択してください。');
        setStatus('');
        return;
      }
    }

    // ステップ2: claim API 取得
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
      setStatus('');
      return;
    }

    // ステップ3: コントラクト呼び出し
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
      setError('コントラクト呼び出し失敗: ' + (e?.message ?? e));
      setStatus('');
      return;
    }
  };

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
          BaseScanで見る
        </a>
      )}
    </div>
  );
}
