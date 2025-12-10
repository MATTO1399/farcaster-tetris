import { NextResponse } from 'next/server';

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const config = {
    accountAssociation: {
      header:
        'eyJmaWQiOjEyMzQ1LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4MTIzNDU2Nzg5MGFiY2RlZiJ9',
      payload: 'eyJkb21haW4iOiJleGFtcGxlLmNvbSJ9',
      signature:
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
    frame: {
      version: '1',
      name: 'Tetris',
      iconUrl: `${appUrl}/icon.png`,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: '#1e1b4b',
      homeUrl: appUrl,
      webhookUrl: `${appUrl}/api/webhook`,
    },
  };

  return NextResponse.json(config);
}
