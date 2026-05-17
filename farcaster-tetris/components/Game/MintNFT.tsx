'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount } from 'wagmi';
import { ethers } from 'ethers';

interface MintNFTProps { address: string; score: number; }

const MintNFT: React.FC<MintNFTProps> = ({ address: propsAddress, score }) => {
  const { address: currentAddress, isConnected } = useAccount(); // ★ 常に最新の接続状況を監視
  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending: isMinting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash });
  
  const [nftToMint, setNftToMint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 所持チェック（このロジック自体は正しいので保持）
  const checkOwnership = useCallback(async () => {
    if (!currentAddress || !publicClient) return;
    setLoading(true);
    const nftAddress = process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`;
    const campaignTextBase = process.env.NEXT_PUBLIC_NFT_CAMPAIGN_TEXT || "FIRST_PLAY_V1";
    const hasClaimedAbi = [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "user", "type": "address" }], "name": "hasClaimed", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }] as const;
    try {
      const firstNftId = ethers.keccak256(ethers.toUtf8Bytes(`${campaignTextBase}_First_NFT`));
      let hasFirst = false;
      try { hasFirst = await publicClient.readContract({ address: nftAddress, abi: hasClaimedAbi, functionName: 'hasClaimed', args: [firstNftId as `0x${string}`, currentAddress as `0x${string}`] }); } catch { hasFirst = false; }
      if (!hasFirst) { setNftToMint("First_NFT"); setLoading(false); return; }
      const thresholds = [10000, 7500, 5000, 3000, 2000, 1000, 100];
      for (const t of thresholds) {
        if (score >= t) {
          const label = `score${t}_NFT`;
          const cId = ethers.keccak256(ethers.toUtf8Bytes(`${campaignTextBase}_${label}`));
          let hasScoreNft = false;
          try { hasScoreNft = await publicClient.readContract({ address: nftAddress, abi: hasClaimedAbi, functionName: 'hasClaimed', args: [cId as `0x${string}`, currentAddress as `0x${string}`] }); } catch { hasScoreNft = false; }
          if (!hasScoreNft) { setNftToMint(label); setLoading(false); return; }
        }
      }
      setNftToMint(null);
    } catch { setNftToMint("First_NFT"); }
    setLoading(false);
  }, [currentAddress, score, publicClient]);

  useEffect(() => { checkOwnership(); }, [checkOwnership]);

  const handleMint = async () => {
    // 診断ログ
    console.log("--- MINT DIAGNOSIS ---");
    console.log("Connected:", isConnected);
    console.log("Account Address:", currentAddress);
    console.log("Target NFT:", nftToMint);
    
    if (!isConnected || !currentAddress) {
      alert("ウォレットが切断されています。ログインし直してください。");
      return;
    }

    try {
      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: currentAddress, score, requestedNft: nftToMint })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }

      // ★ 確実に実行するために、引数を整理して直接呼び出す
      writeContract({
        address: process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`,
        abi: [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "deadline", "type": "uint256" }, { "name": "signature", "type": "bytes" }], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" }],
        functionName: 'claim',
        args: [data.campaignId, BigInt(data.deadline), data.signature],
      });
      
      console.log("writeContract called. Waiting for wallet response...");
    } catch (error) {
      console.error("Critical Mint Error:", error);
    }
  };

  if (loading) return null;
  if (!nftToMint || isMintSuccess) return isMintSuccess ? <div className="text-green-400 font-bold text-center">ミント成功！🎉</div> : null;

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMint();
      }}
      disabled={isMinting || isConfirming}
      className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black rounded-full font-bold shadow-lg active:scale-95 cursor-pointer z-[9999]"
      style={{ position: 'relative', pointerEvents: 'auto' }}
    >
      {isMinting || isConfirming ? '承認中...' : `${nftToMint} をGET!`}
    </button>
  );
};

export default MintNFT;
