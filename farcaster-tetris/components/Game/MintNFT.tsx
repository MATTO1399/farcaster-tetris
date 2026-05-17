'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';

interface MintNFTProps {
  address: string;
  score: number;
}

const MintNFT: React.FC<MintNFTProps> = ({ address, score }) => {
  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending: isMinting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash });
  
  const [nftToMint, setNftToNftToMint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // NFTの優先順位としきい値
  const SCORE_THRESHOLDS = [10000, 7500, 5000, 3000, 2000, 1000, 100];

  const checkOwnership = useCallback(async () => {
    if (!address || !publicClient) return;
    setLoading(true);

    const nftAddress = process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`;
    const campaignTextBase = process.env.NEXT_PUBLIC_NFT_CAMPAIGN_TEXT || "FIRST_PLAY_V1";

    try {
      // 1. まず First_NFT を持っているかチェック
      const firstNftId = ethers.keccak256(ethers.toUtf8Bytes(`${campaignTextBase}_First_NFT`));
      const hasFirst = await publicClient.readContract({
        address: nftAddress,
        abi: [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "user", "type": "address" }], "name": "hasClaimed", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }],
        functionName: 'hasClaimed',
        args: [firstNftId as `0x${string}`, address as `0x${string}`]
      });

      if (!hasFirst) {
        setNftToNftToMint("First_NFT");
        setLoading(false);
        return;
      }

      // 2. スコア順に持っていないものを探す
      for (const threshold of SCORE_THRESHOLDS) {
        if (score >= threshold) {
          const label = `score${threshold}_NFT`;
          const campaignId = ethers.keccak256(ethers.toUtf8Bytes(`${campaignTextBase}_${label}`));
          
          const hasScoreNft = await publicClient.readContract({
            address: nftAddress,
            abi: [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "user", "type": "address" }], "name": "hasClaimed", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }],
            functionName: 'hasClaimed',
            args: [campaignId as `0x${string}`, address as `0x${string}`]
          });

          if (!hasScoreNft) {
            setNftToNftToMint(label);
            setLoading(false);
            return;
          }
        }
      }

      // 全部持っているか、条件未達成
      setNftToNftToMint(null);
    } catch (e) {
      console.error("Check ownership error:", e);
    }
    setLoading(false);
  }, [address, score, publicClient]);

  useEffect(() => { checkOwnership(); }, [checkOwnership]);

  const handleMint = async () => {
    if (!nftToMint) return;
    try {
      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, score, requestedNft: nftToMint }) // どのNFTが欲しいか送る
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }

      writeContract({
        address: process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`,
        abi: [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "deadline", "type": "uint256" }, { "name": "signature", "type": "bytes" }], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" }],
        functionName: 'claim',
        args: [data.campaignId, BigInt(data.deadline), data.signature],
      });
    } catch (error) { alert('エラーが発生しました'); }
  };

  if (loading) return <div className="text-gray-400 text-xs">所持状況を確認中...</div>;
  if (!nftToMint || isMintSuccess) return isMintSuccess ? <div className="text-green-400 font-bold">ミント成功！🎉</div> : null;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleMint(); }}
      disabled={isMinting || isConfirming}
      className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black rounded-full font-bold shadow-lg active:scale-95 z-[200]"
    >
      {isMinting || isConfirming ? '通信中...' : `${nftToMint} をGET!`}
    </button>
  );
};

export default MintNFT;
