import { NextRequest, NextResponse } from 'next/server';

const TIER_IMAGES: Record<string, { 
  name: string; 
  description: string; 
  image: string; 
  attributes: { trait_type: string; value: string | number }[] 
}> = {
  bronze: {
    name: 'Tetris Bronze NFT',
    description: 'Awarded for achieving a score of 100 or more in Farcaster Tetris.',
    image: 'https://4uv7ayhgc376ejly.public.blob.vercel-storage.com/photo/tier_bronze.png',
    attributes: [
      { trait_type: 'Tier', value: 'Bronze' },
      { trait_type: 'Min Score', value: 100 },
      { trait_type: 'Edition', value: 'Limited' }
    ]
  },
  silver: {
    name: 'Tetris Silver NFT',
    description: 'Awarded for achieving a score of 500 or more in Farcaster Tetris.',
    image: 'https://4uv7ayhgc376ejly.public.blob.vercel-storage.com/photo/tier_silver.png',
    attributes: [
      { trait_type: 'Tier', value: 'Silver' },
      { trait_type: 'Min Score', value: 500 },
      { trait_type: 'Edition', value: 'Limited' }
    ]
  },
  gold: {
    name: 'Tetris Gold NFT',
    description: 'Awarded for achieving a score of 1000 or more in Farcaster Tetris.',
    image: 'https://4uv7ayhgc376ejly.public.blob.vercel-storage.com/photo/tier_gold.png',
    attributes: [
      { trait_type: 'Tier', value: 'Gold' },
      { trait_type: 'Min Score', value: 1000 },
      { trait_type: 'Edition', value: 'Limited' }
    ]
  },
  platinum: {
    name: 'Tetris Platinum NFT',
    description: 'Awarded for achieving a score of 3000 or more in Farcaster Tetris. Exclusive.',
    image: 'https://4uv7ayhgc376ejly.public.blob.vercel-storage.com/photo/tier_platinum.png',
    attributes: [
      { trait_type: 'Tier', value: 'Platinum' },
      { trait_type: 'Min Score', value: 3000 },
      { trait_type: 'Edition', value: 'Exclusive' }
    ]
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: { tier: string; tokenId: string } }
) {
  const tierInfo = TIER_IMAGES[params.tier.toLowerCase()];
  
  if (!tierInfo) {
    return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
  }

  const tokenId = params.tokenId.replace('.json', '');
  
  return NextResponse.json({
    name: `${tierInfo.name} #${tokenId}`,
    description: tierInfo.description,
    image: tierInfo.image,
    attributes: tierInfo.attributes
  });
}
