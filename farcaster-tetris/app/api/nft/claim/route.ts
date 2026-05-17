import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST(request: NextRequest) {
  try {
    const { address, score, requestedNft } = await request.json();

    // 1. 基本的な入力チェック
    if (!address || score === undefined) {
      return NextResponse.json({ error: 'Missing address or score' }, { status: 400 });
    }

    // 2. ミント対象のNFTを決定
    // フロントエンドが所持チェックした結果（requestedNft）があればそれを優先
    // なければデフォルトで "First_NFT" にします
    const nftLabel = requestedNft || "First_NFT";

    // 3. 署名環境のチェック
    const privKey = process.env.NFT_SIGNER_PRIVATE_KEY;
    const nftAddress = process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS;
    const campaignBase = process.env.NEXT_PUBLIC_NFT_CAMPAIGN_TEXT || "FIRST_PLAY_V1";

    if (!privKey || !nftAddress) {
      console.error("Missing SIGNER_PRIVATE_KEY or NFT_ADDRESS in env");
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // 4. 署名の作成 (EIP-712 準拠)
    const wallet = new ethers.Wallet(privKey);
    const domain = {
      name: "FirstPlayNFT",
      version: "1",
      chainId: 84532, // Base Sepolia
      verifyingContract: nftAddress
    };

    const types = {
      Claim: [
        { name: "recipient", type: "address" },
        { name: "campaignId", type: "bytes32" },
        { name: "deadline", type: "uint256" }
      ]
    };

    // キャンペーンIDの生成（NFTのラベル名と連動させて、1種類1回制限を実現）
    const campaignText = `${campaignBase}_${nftLabel}`;
    const campaignId = ethers.keccak256(ethers.toUtf8Bytes(campaignText));
    const deadline = Math.floor(Date.now() / 1000) + 600; // 10分間有効

    const value = {
      recipient: address,
      campaignId: campaignId,
      deadline: deadline
    };

    // 署名を実行
    const signature = await wallet.signTypedData(domain, types, value);

    // フロントエンドに必要な情報をすべて返す
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
