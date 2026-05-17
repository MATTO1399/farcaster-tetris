'use client';

import React, { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

interface MintNFTProps {
  address: string;
  score: number;
}

const MintNFT: React.FC<MintNFTProps> = ({ address, score }) => {
  const { writeContract, data: hash, isPending: isMinting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({ hash });
  const [pendingNftLabel, setPendingNftLabel] = useState<string | null>(null);

  const handleMint = async () => {
    try {
      const nftAddress = process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS;
      if (!nftAddress) {
        alert('設定エラー: NFTアドレスがありません');
        return;
      }

      const res = await fetch('/api/nft/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, score })
      });
      
      const data = await res.json();
      if (data.error) {
        alert(`条件未達成: ${data.error}`);
        return;
      }

      setPendingNftLabel(data.nftLabel);

      writeContract({
        address: nftAddress as `0x${string}`,
        abi: [{ "inputs": [{ "name": "campaignId", "type": "bytes32" }, { "name": "deadline", "type": "uint256" }, { "name": "signature", "type": "bytes" }], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" }],
        functionName: 'claim',
        args: [data.campaignId, BigInt(data.deadline), data.signature],
      });
    } catch (error) {
      console.error('Mint Error:', error);
      alert('ミント中にエラーが発生しました');
    }
  };

  if (isMintSuccess) {
    return (
      <div className="w-full py-2 bg-green-500/20 border border-green-500 text-green-400 rounded-lg text-sm font-bold animate-pulse text-center">
        ミント成功！🎉
      </div>
    );
  }

  return (
    <button
      onClick={handleMint}
      disabled={isMinting || isConfirming}
      className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black rounded-full font-bold transition-all shadow-lg active:scale-95 disabled:grayscale"
    >
      {isMinting || isConfirming ? 'ミント中...' : `${pendingNftLabel || (score >= 100 ? 'Achievement NFT' : 'First Play NFT')} をGET!`}
    </button>
  );
};

export default MintNFT;
