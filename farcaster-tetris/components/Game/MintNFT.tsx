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
  
  const [nftToMint, setNftToMint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const SCORE_THRESHOLDS = [10000, 7500, 5000, 3000, 2000, 1000, 100];

  const checkOwnership = useCallback(async () => {
    if (!address || !publicClient) return;
    setLoading(true);

    const nftAddress = process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`;
    const campaignTextBase = process.env.NEXT_PUBLIC_NFT_CAMPAIGN_TEXT || "FIRST_PLAY_V1";

    // 共通のABI定義
    const hasClaimedAbi = [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "user", "type": "address" }], "name": "hasClaimed", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }] as const;

    try {
      // 1. First_NFT のチェック
      const firstNftId = ethers.keccak256(ethers.toUtf8Bytes(`${campaignTextBase}_First_NFT`));
      let hasFirst = false;
      try {
        hasFirst = await publicClient.readContract({
          address: nftAddress,
          abi: hasClaimedAbi,
          functionName: 'hasClaimed',
          args: [firstNftId as `0x${string}`, address as `0x${string}`]
        });
      } catch (e) {
        // エラーが出た場合は「まだ持っていない」とみなす
        hasFirst = false;
      }

      if (!hasFirst) {
        setNftToMint("First_NFT");
        setLoading(false);
        return;
      }

      // 2. スコア別NFTのチェック
      for (const threshold of SCORE_THRESHOLDS) {
        if (score >= threshold) {
          const label = `score${threshold}_NFT`;
          const campaignId = ethers.keccak256(ethers.toUtf8Bytes(`${campaignTextBase}_${label}`));
          
          let hasScoreNft = false;
          try {
            hasScoreNft = await publicClient.readContract({
              address: nftAddress,
              abi: hasClaimedAbi,
              functionName: 'hasClaimed',
              args: [campaignId as `0x${string}`, address as `0x${string}`]
            });
          } catch (e) {
            hasScoreNft = false;
          }

          if (!hasScoreNft) {
            setNftToMint(label);
            setLoading(false);
            return;
          }
        }
      }
      setNftToMint(null);
    } catch (globalError) {
      console.error("Critical check error:", globalError);
      // 万が一の時も、初回はボタンを出す方向に倒す
      setNftToMint("First_NFT");
    }
    setLoading(false);
  }, [address, score, publicClient]);

  useEffect(() => { checkOwnership(); }, [checkOwnership]);

  const handleMint = async () => {
    console.log("handleMint started. Address:", address);
    if (!nftToMint) return;
    try {
      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, score, requestedNft: nftToMint })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }

      writeContract({
        address: process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`,
        abi: [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "deadline", "type": "uint256" }, { "name": "signature", "type": "bytes" }], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" }],
        functionName: 'claim',
        args: [data.campaignId, BigInt(data.deadline), data.signature],
      });
    } catch (error) { alert('ミント処理に失敗しました'); }
  };

  if (loading) return null; // ロード中は何も出さない（じゃまにならない）
  if (!nftToMint || isMintSuccess) return isMintSuccess ? <div className="text-green-400 font-bold text-center">ミント成功！🎉</div> : null;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleMint(); }}
      disabled={isMinting || isConfirming}
      className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black rounded-full font-bold shadow-lg active:scale-95"
    >
      {isMinting || isConfirming ? '処理中...' : `${nftToMint} をGET!`}
    </button>
  );
};

export default MintNFT;
