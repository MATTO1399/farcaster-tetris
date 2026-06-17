import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const TIER_NAMES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
const TIER_MIN_SCORES = [100, 500, 1000, 3000];

// サーバー側nonce用カウンタ（連続値: 衝突防止）
let lastNonceValue = 0n;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, tier, score } = body;

    // ① バリデーション
    if (!address || typeof tier !== 'number' || typeof score !== 'number') {
      return NextResponse.json(
        { error: 'address, tier (0-3), score required' },
        { status: 400 }
      );
    }
    if (tier < 0 || tier > 3 || !Number.isInteger(tier)) {
      return NextResponse.json({ error: 'tier must be 0-3' }, { status: 400 });
    }
    if (score < TIER_MIN_SCORES[tier]) {
      return NextResponse.json(
        { error: `Score ${score} is too low for ${TIER_NAMES[tier]} (need ${TIER_MIN_SCORES[tier]}+)` },
        { status: 400 }
      );
    }

    // ② 環境変数
    const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;
    const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
    const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TETRIS_TIER_NFT_ADDRESS;
    const NFT_NAME = process.env.NEXT_PUBLIC_TETRIS_TIER_NFT_NAME || 'Farcaster Tetris Tier';

    if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
      return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
    }

    // ③ コントラクト情報取得
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contractABI = [
      'function campaignId() view returns (bytes32)',
      'function minted(address,uint8) view returns (bool)'
    ];
    const contract = new ethers.Contract(CONTRACT_ADDRESS!, contractABI, provider);

    const campaignId = await contract.campaignId();

    // ④ 既にミント済か確認
    try {
      const minted = await contract.minted(address, tier);
      if (minted) {
        return NextResponse.json(
          { error: `This address has already claimed ${TIER_NAMES[tier]} tier NFT.` },
          { status: 400 }
        );
      }
    } catch (e) {
      // エラーなら握りつぶし (claim 側で二重チェックされる)
    }

    // ⑤ nonce 単調増加
    const nextNonce = BigInt(Date.now()) * 1000n + (lastNonceValue++ % 1000n);
    const nonce = nextNonce;

    // ⑥ 署名生成
    const signerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const deadline = Math.floor(Date.now() / 1000) + 600;

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

    const message = {
      to: address,
      tier: tier,
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
      tier,
      tierName: TIER_NAMES[tier]
    });
  } catch (error: any) {
    console.error('tier-claim error', error);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: String(error?.message ?? error) },
      { status: 500 }
    );
  }
}
