import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasRpcUrl: !!process.env.BASE_SEPOLIA_RPC_URL,
    hasPrivateKey: !!process.env.DEPLOYER_PRIVATE_KEY,
    contractAddress: process.env.NEXT_PUBLIC_FIRST_PLAY_NFT_ADDRESS || null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
    // 値の長さを返して set済みか・空文字じゃないか確認
    rpcUrlLength: process.env.BASE_SEPOLIA_RPC_URL?.length || 0,
    privateKeyLength: process.env.DEPLOYER_PRIVATE_KEY?.length || 0,
  });
}
