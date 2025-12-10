import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    accountAssociation: {
      header: "eyJmaWQiOjEyMzQ1LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4MTIzNDU2Nzg5MGFiY2RlZiJ9",
      payload: "eyJkb21haW4iOiJleGFtcGxlLmNvbSJ9",
      signature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    },
    frame: {
      version: "1",
      name: "Tetris",
      iconUrl: "https://farcaster-tetris.vercel.app/icon.png",
      splashImageUrl: "https://farcaster-tetris.vercel.app/splash.png",
      splashBackgroundColor: "#1e1b4b",
      homeUrl: "https://farcaster-tetris.vercel.app",
      webhookUrl: "https://farcaster-tetris.vercel.app/api/webhook"
    }
  });
}
