'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount } from 'wagmi';
import { ethers } from 'ethers';

interface MintNFTProps { address: string; score: number; }

const MintNFT: React.FC<MintNFTProps> = ({ address: propsAddress, score }) => {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending: isMinting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash });
  
  const [nftToMint, setNftToMint] = useState<string | null>("First_NFT"); // 初期値を設定してボタン消失を防ぐ
  const [loading, setLoading] = useState(true);

  // 所持チェック
  const checkOwnership = useCallback(async () => {
    if (!propsAddress || !publicClient) return;
    try {
      const nftAddress = process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`;
      const campaignTextBase = process.env.NEXT_PUBLIC_NFT_CAMPAIGN_TEXT || "FIRST_PLAY_V1";
      const abi = [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "user", "type": "address" }], "name": "hasClaimed", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }] as const;

      const firstId = ethers.keccak256(ethers.toUtf8Bytes(`${campaignTextBase}_First_NFT`));
      let hasFirst = false;
      try { hasFirst = await publicClient.readContract({ address: nftAddress, abi, functionName: 'hasClaimed', args: [firstId as `0x${string}`, propsAddress as `0x${string}`] }); } catch { hasFirst = false; }

      if (!hasFirst) { setNftToMint("First_NFT"); }
      else {
        const thresholds = [10000, 7500, 5000, 3000, 2000, 1000, 100];
        let found = null;
        for (const t of thresholds) {
          if (score >= t) {
            const label = `score${t}_NFT`;
            const cId = ethers.keccak256(ethers.toUtf8Bytes(`${campaignTextBase}_${label}`));
            let hasS = false;
            try { hasS = await publicClient.readContract({ address: nftAddress, abi, functionName: 'hasClaimed', args: [cId as `0x${string}`, propsAddress as `0x${string}`] }); } catch { hasS = false; }
            if (!hasS) { found = label; break; }
          }
        }
        setNftToMint(found);
      }
    } catch (e) { console.error("Ownership check failed", e); }
    setLoading(false);
  }, [propsAddress, score, publicClient]);

  useEffect(() => { void checkOwnership(); }, [checkOwnership]);

  const handleMint = async () => {
    console.log("!!! MINT BUTTON CLICKED !!!");
    console.log("Is Wallet Connected:", isConnected);
    console.log("Address:", propsAddress);
    
    try {
      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: propsAddress, score, requestedNft: nftToMint })
      });
      const data = await res.json();
      if (data.error) { alert(`Error: ${data.error}`); return; }

      console.log("Calling writeContract...");
      writeContract({
        address: process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`,
        abi: [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "deadline", "type": "uint256" }, { "name": "signature", "type": "bytes" }], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" }],
        functionName: 'claim',
        args: [data.campaignId, BigInt(data.deadline), data.signature],
      });
    } catch (e) { alert("通信に失敗しました。"); }
  };

  // ミント成功時のみメッセージを表示、それ以外はボタンを出し続ける
  if (isMintSuccess) return <div className="text-green-400 font-bold text-center py-4">ミント成功！🎉</div>;
  if (!nftToMint && !loading) return null; // 全部持っている場合のみ消す

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMint(); }}
      disabled={isMinting || isConfirming}
      className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black rounded-full font-extrabold shadow-[0_0_20px_rgba(245,158,11,0.5)] active:scale-95 cursor-pointer"
      style={{ position: 'relative', zIndex: 9999, pointerEvents: 'auto' }}
    >
      {isMinting || isConfirming ? '処理中...' : `${nftToMint} をGET!`}
    </button>
  );
};

export default MintNFT;
