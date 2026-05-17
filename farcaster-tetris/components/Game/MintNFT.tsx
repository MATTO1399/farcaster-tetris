'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount } from 'wagmi';
import { ethers } from 'ethers';

interface MintNFTProps { address: string; score: number; }

const MintNFT: React.FC<MintNFTProps> = ({ address, score }) => {
  const publicClient = usePublicClient();
  const { connector } = useAccount(); // ★現在の接続コネクターを取得
  const { writeContract, data: hash, isPending: isMinting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash });
  
  const [nftToMint, setNftToMint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const SCORE_THRESHOLDS = [10000, 7500, 5000, 3000, 2000, 1000, 100];

  // 所持チェックロジック (既存のまま保持)
  const checkOwnership = useCallback(async () => {
    if (!address || !publicClient) return;
    setLoading(true);
    const nftAddress = process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`;
    const campaignTextBase = process.env.NEXT_PUBLIC_NFT_CAMPAIGN_TEXT || "FIRST_PLAY_V1";
    const hasClaimedAbi = [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "user", "type": "address" }], "name": "hasClaimed", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }] as const;
    try {
      const firstNftId = ethers.keccak256(ethers.toUtf8Bytes(`${campaignTextBase}_First_NFT`));
      let hasFirst = false;
      try { hasFirst = await publicClient.readContract({ address: nftAddress, abi: hasClaimedAbi, functionName: 'hasClaimed', args: [firstNftId as `0x${string}`, address as `0x${string}`] }); } catch { hasFirst = false; }
      if (!hasFirst) { setNftToMint("First_NFT"); setLoading(false); return; }
      for (const threshold of SCORE_THRESHOLDS) {
        if (score >= threshold) {
          const label = `score${threshold}_NFT`;
          const campaignId = ethers.keccak256(ethers.toUtf8Bytes(`${campaignTextBase}_${label}`));
          let hasScoreNft = false;
          try { hasScoreNft = await publicClient.readContract({ address: nftAddress, abi: hasClaimedAbi, functionName: 'hasClaimed', args: [campaignId as `0x${string}`, address as `0x${string}`] }); } catch { hasScoreNft = false; }
          if (!hasScoreNft) { setNftToMint(label); setLoading(false); return; }
        }
      }
      setNftToMint(null);
    } catch (e) { setNftToMint("First_NFT"); }
    setLoading(false);
  }, [address, score, publicClient]);

  useEffect(() => { checkOwnership(); }, [checkOwnership]);

  const handleMint = async () => {
    console.log("Attempting mint with Rabby/Connector:", connector?.name);
    if (!nftToMint) return;
    
    try {
      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, score, requestedNft: nftToMint })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }

      // ★ 修正ポイント: connectorを明示的に渡すことで、Rabbyの競合を回避します
      writeContract({
        connector: connector, // ここが重要
        address: process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`,
        abi: [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "deadline", "type": "uint256" }, { "name": "signature", "type": "bytes" }], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" }],
        functionName: 'claim',
        args: [data.campaignId, BigInt(data.deadline), data.signature],
      });
    } catch (error) {
      console.error('Mint Technical Error:', error);
      alert('ミントの呼び出しに失敗しました。Rabbyの承認画面が開いているか確認してください。');
    }
  };

  if (loading) return null;
  if (!nftToMint || isMintSuccess) return isMintSuccess ? <div className="text-green-400 font-bold text-center py-2">ミント成功！🎉</div> : null;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleMint(); }}
      disabled={isMinting || isConfirming}
      className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black rounded-full font-bold shadow-lg active:scale-95 cursor-pointer"
      style={{ pointerEvents: 'auto', position: 'relative', zIndex: 1000 }}
    >
      {isMinting || isConfirming ? '承認待ち...' : `${nftToMint} をGET!`}
    </button>
  );
};

export default MintNFT;
