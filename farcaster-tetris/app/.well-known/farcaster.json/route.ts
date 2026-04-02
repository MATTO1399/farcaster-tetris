import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    accountAssociation: {
      header: "eyJmaWQiOjE4OTk0LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4M2RjNzgxQzg1NzExNGJDNjgzRTJCMzY2M2JDOTA0OGU1YkE3ODE3MSJ9",
      payload: "eyJkb21haW4iOiJmYXJjYXN0ZXItdGV0cmlzLnZlcmNlbC5hcHAifQ",
      signature: "cfCmm1OsTTL5apfOjSRPHNXeVKBXhijtg6RfGBS8tVIgTpjmbzQxf10IBpQrWKc4KA9/t3fvZuh3VyHj33MAZxs="
    },
    frame: {
      version: "1",
      name: "FARTETRIS",
      iconUrl: "https://farcaster-tetris.vercel.app/icon.png",
      splashImageUrl: "https://farcaster-tetris.vercel.app/splash.png",
      splashBackgroundColor: "#1e1b4b",
      homeUrl: "https://farcaster-tetris.vercel.app",
      webhookUrl: "https://farcaster-tetris.vercel.app/api/webhook",
      primaryCategory: "games",  // ← 追加
      tags: ["tetris", "game", "arcade", "puzzle", "classic"]  // ← 追加（最大5つ）
    }
  });
}
