'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount, useSwitchChain } from 'wagmi';
import { ethers } from 'ethers';
import { baseSepolia } from 'wagmi/chains'; // ★ネットワーク切り替え用

interface MintNFTProps { address: string; score: number; }

const MintNFT: React.FC<MintNFTProps> = ({ address: propsAddress, score }) => {
  const { chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain(); // ★ネットワーク切り替え用
  const publicClient = usePublicClient();
  const { writeContract, data: hash, isPending: isMinting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash });
  
  const [nftToMint, setNftToMint] = useState<string | null>("First_NFT");
  const TARGET_CHAIN_ID = 84532; // Base Sepolia

  // 所持チェックロジック (GitHubの最新版)
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
    } catch (e) { console.error(e); }
  }, [propsAddress, score, publicClient]);

  useEffect(() => { void checkOwnership(); }, [checkOwnership]);

  const handleMint = async () => {
    // ★ ネットワークチェック
    if (chainId !== TARGET_CHAIN_ID) {
      if (confirm("ネットワークが Base Sepolia ではありません。切り替えますか？")) {
        switchChain({ chainId: TARGET_CHAIN_ID });
      }
      return;
    }

    try {
      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: propsAddress, score, requestedNft: nftToMint })
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }

      writeContract({
        address: process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS as `0x${string}`,
        abi: [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "deadline", "type": "uint256" }, { "name": "signature", "type": "bytes" }], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" }],
        functionName: 'claim',
        args: [data.campaignId, BigInt(data.deadline), data.signature],
      });
    } catch (e) { alert("通信エラー"); }
  };

  if (isMintSuccess) return <div className="text-green-400 font-bold text-center py-4">ミント成功！🎉</div>;
  if (!nftToMint) return null;

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMint(); }}
      disabled={isMinting || isConfirming}
      className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black rounded-full font-extrabold shadow-lg active:scale-95"
    >
      {isMinting || isConfirming ? '承認中...' : `${nftToMint} をGET!`}
    </button>
  );
};

export default MintNFT;
