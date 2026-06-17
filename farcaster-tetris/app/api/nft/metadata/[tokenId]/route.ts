import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { tokenId: string } },
) {
  const rawTokenId = params.tokenId;
  const tokenId = rawTokenId.endsWith('.json')
    ? rawTokenId.slice(0, -5)
    : rawTokenId;

  const metadata = {
    name: `First_NFT #${tokenId}`,
    description:
      'This NFT was awarded for completing your first game of Farcaster Tetris. Play more to earn achievement NFTs.',
    image:
      'https://4uv7ayhgc376ejly.public.blob.vercel-storage.com/photo/first_play_en.png',
    attributes: [
      { trait_type: 'Type', value: 'First Play' },
      { trait_type: 'Edition', value: 'Unique' },
    ],
  };

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}
