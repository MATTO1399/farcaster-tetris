import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, score } = body;

    const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;
    const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
    const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://farcaster-tetris.vercel.app';

    if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500 },
      );
    }

    const contractABI = [
      'function hasClaimed(address account) view returns (bool)',
      'function campaignId() view returns (bytes32)',
    ];

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS!, contractABI, provider);

    const campaignId = await contract.campaignId();
    const hasClaimed: boolean = await contract.hasClaimed(address);

    if (hasClaimed) {
      return NextResponse.json(
        {
          error:
            'This address has already claimed First_NFT. Score-based NFTs require an upgraded contract.',
        },
        { status: 400 },
      );
    }

    const domain = {
      name: 'FirstPlayNFT',
      version: '1',
      chainId: 84532,
      verifyingContract: CONTRACT_ADDRESS!,
    };

    const types = {
      Claim: [
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' },
        { name: 'campaignId', type: 'bytes32' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    const nonce = Date.now();
    const deadline = Math.floor(Date.now() / 1000) + 600;

    const message = {
      to: address,
      deadline,
      campaignId,
      nonce,
    };

    const signature = await signer.signTypedData(domain, types, message);

    return NextResponse.json({
      domain,
      types,
      primaryType: 'Claim',
      message,
      signature,
      contractAddress: CONTRACT_ADDRESS,
      score,
    });
  } catch (error: any) {
    console.error('claim error', error);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: String(error?.message ?? error) },
      { status: 500 },
    );
  }
}
