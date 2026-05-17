import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const SCORE_THRESHOLDS = [100, 1000, 2000, 3000, 5000, 7500, 10000];

export async function POST(request: NextRequest) {
  try {
    const { address, score } = await request.json();

    if (!address || score === undefined) {
      return NextResponse.json({ error: 'Missing address or score' }, { status: 400 });
    }

    // 1. スコア条件の判定
    const achievedThreshold = [...SCORE_THRESHOLDS].reverse().find(t => score >= t);

    // 2. NFTのラベル（名前）を決定
    // 100点未満なら「First_NFT」、100点以上なら「scoreXXX_NFT」
    const nftLabel = achievedThreshold ? `score${achievedThreshold}_NFT` : "First_NFT";

    // 3. 署名の作成 (EIP-712)
    const privKey = process.env.NFT_SIGNER_PRIVATE_KEY;
    if (!privKey) throw new Error('Signer key missing');

    const wallet = new ethers.Wallet(privKey);
    const domain = {
      name: "FirstPlayNFT",
      version: "1",
      chainId: 84532, // Base Sepolia
      verifyingContract: process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS
    };

    const types = {
      Claim: [
        { name: "recipient", type: "address" },
        { name: "campaignId", type: "bytes32" },
        { name: "deadline", type: "uint256" }
      ]
    };

    // キャンペーンIDもラベル名と連動させる（これで種類別に1回ずつミント可能になる）
    const campaignText = `${process.env.NEXT_PUBLIC_NFT_CAMPAIGN_TEXT}_${nftLabel}`;
    const campaignId = ethers.keccak256(ethers.toUtf8Bytes(campaignText));
    const deadline = Math.floor(Date.now() / 1000) + 600; // 10分間有効

    const value = {
      recipient: address,
      campaignId: campaignId,
      deadline: deadline
    };

    const signature = await wallet.signTypedData(domain, types, value);

    return NextResponse.json({
      signature,
      deadline,
      campaignId,
      nftLabel
    });

  } catch (error) {
    console.error('Claim API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
