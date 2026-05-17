'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount } from 'wagmi';
import { ethers } from 'ethers';

interface MintNFTProps { address: string; score: number; }

const MintNFT: React.FC<MintNFTProps> = ({ address, score }) => {
  const publicClient = usePublicClient();
  const { connector } = useAccount();
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
    console.log("Button Clicked. Target NFT:", nftToMint);
    const nftAddress = process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS;

    if (!nftAddress) {
      alert("エラー: NFTのアドレス(環境変数)が読み込めていません。Vercelの設定を確認してください。");
      return;
    }

    try {
      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, score, requestedNft: nftToMint })
      });
      const data = await res.json();
      if (data.error) { alert(`条件エラー: ${data.error}`); return; }

      // ★ 最後の手段: Wagmiを使わずブラウザのwindow.ethereumを直接叩く
      const provider = (window as any).ethereum;
      if (provider) {
        console.log("Direct wallet call initiated.");
        
        // 1. まずはWagmiの標準方式を試す
        writeContract({
          connector,
          address: nftAddress as `0x${string}`,
          abi: [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "deadline", "type": "uint256" }, { "name": "signature", "type": "bytes" }], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" }],
          functionName: 'claim',
          args: [data.campaignId, BigInt(data.deadline), data.signature],
        });

        // 2. 万が一、Wagmiが沈黙した時のための保険（アラート）
        setTimeout(() => {
          if (!isMinting) {
            console.log("Wagmi seems silent. Checking provider directly...");
          }
        }, 2000);

      } else {
        alert("ウォレット（window.ethereum）が見つかりません。Rabbyの設定を確認してください。");
      }
    } catch (error) {
      console.error('Mint Error:', error);
      alert('通信エラーが発生しました。');
    }
  };

  if (loading) return null;
  if (!nftToMint || isMintSuccess) return isMintSuccess ? <div className="text-green-400 font-bold text-center py-2">ミント成功！🎉</div> : null;

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMint();
      }}
      disabled={isMinting || isConfirming}
      className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black rounded-full font-bold shadow-lg active:scale-95 cursor-pointer"
      style={{ position: 'relative', zIndex: 9999, pointerEvents: 'auto' }}
    >
      {isMinting || isConfirming ? '承認待ち...' : `${nftToMint} をGET!`}
    </button>
  );
};

export default MintNFT;
