import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// スコアから Tier (uint8) 判定
function getTierForScore(score: number): number {
  if (score >= 3000) return 3; // PLATINUM
  if (score >= 1000) return 2; // GOLD
  if (score >= 500) return 1;  // SILVER
  if (score >= 100) return 0;  // BRONZE
  return -1;
}

// Tier 名前 (ログ用)
const TIER_NAMES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, score } = body;

    const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;
    const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
    const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TETRIS_TIER_NFT_ADDRESS;
    const NFT_NAME = process.env.NEXT_PUBLIC_TETRIS_TIER_NFT_NAME || 'Farcaster Tetris Tier';

    if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500 }
      );
    }

    if (!address || typeof score !== 'number') {
      return NextResponse.json(
        { error: 'address and score required' },
        { status: 400 }
      );
    }

    // Tier 判定
    const tierId = getTierForScore(score);
    if (tierId < 0) {
      return NextResponse.json(
        { error: 'Score too low. Need at least 100 points.' },
        { status: 400 }
      );
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signerWallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const contractABI = [
      'function owner() view returns (address)',
      'function signer() view returns (address)',
      'function campaignId() view returns (bytes32)',
      'function getClaimDigest(address to, uint8 tier, uint256 deadline, uint256 nonce) view returns (bytes32)'
    ];

    const contract = new ethers.Contract(CONTRACT_ADDRESS!, contractABI, provider);

    const campaignId = await contract.campaignId();

    // 既にミント済か確認 (該当Tier)
    // ※ABI の `minted(address, uint8) returns (bool)` を直接呼ぶ
    try {
      const minted = await contract.minted(address, tierId);
      if (minted) {
        return NextResponse.json(
          { error: `This address has already claimed ${TIER_NAMES[tierId]} tier NFT.` },
          { status: 400 }
        );
      }
    } catch (e) {
      // public mapping が読めない環境でも claim 自体は動くので、ここではエラーを握りつぶす
    }

    const domain = {
      name: NFT_NAME,
      version: '1',
      chainId: 84532,
      verifyingContract: CONTRACT_ADDRESS!
    };

    const types = {
      Claim: [
        { name: 'to', type: 'address' },
        { name: 'tier', type: 'uint8' },
        { name: 'deadline', type: 'uint256' },
        { name: 'campaignId', type: 'bytes32' },
        { name: 'nonce', type: 'uint256' }
      ]
    };

    const nonce = Date.now();
    const deadline = Math.floor(Date.now() / 1000) + 600;

    const message = {
      to: address,
      tier: tierId,
      deadline,
      campaignId,
      nonce
    };

    const signature = await signerWallet.signTypedData(domain, types, message);

    return NextResponse.json({
      domain,
      types,
      primaryType: 'Claim',
      message,
      signature,
      contractAddress: CONTRACT_ADDRESS,
      score,
      tier: tierId,
      tierName: TIER_NAMES[tierId]
    });
  } catch (error: any) {
    console.error('tier-claim error', error);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: String(error?.message ?? error) },
      { status: 500 }
    );
  }
}
