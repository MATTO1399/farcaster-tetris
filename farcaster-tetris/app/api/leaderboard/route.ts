import { NextResponse } from 'next/server';
import { getTopScores, saveScore, getUserRank, getUserHighScore } from '@/lib/leaderboard';
import type { LeaderboardEntry } from '@/lib/leaderboard';

// GET: ランキング取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (fid) {
      // 特定ユーザーの情報取得
      const highScore = await getUserHighScore(parseInt(fid));
      const rank = await getUserRank(parseInt(fid));
      
      return NextResponse.json({
        highScore,
        rank,
      });
    } else {
      // トップ10取得
      const topScores = await getTopScores(10);
      return NextResponse.json(topScores);
    }
  } catch (error) {
    console.error('Leaderboard GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}

// POST: スコア保存
export async function POST(request: Request) {
  try {
    const entry: LeaderboardEntry = await request.json();
    
    // バリデーション
    if (!entry.fid || !entry.username || typeof entry.score !== 'number') {
      return NextResponse.json({ error: 'Invalid entry data' }, { status: 400 });
    }
    
    await saveScore(entry);
    
    // 保存後のランク取得
    const rank = await getUserRank(entry.fid);
    
    return NextResponse.json({
      success: true,
      rank,
    });
  } catch (error) {
    console.error('Leaderboard POST error:', error);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
}