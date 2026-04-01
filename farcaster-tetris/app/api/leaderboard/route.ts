import { NextRequest, NextResponse } from 'next/server';
import {
  getTopScores,
  getUserHighScore,
  getUserRank,
  saveScore,
  type LeaderboardEntry,
} from '../../../lib/leaderboard';

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address');

    if (address) {
      const normalizedAddress = address.toLowerCase();
      const [highScore, rank] = await Promise.all([
        getUserHighScore(normalizedAddress),
        getUserRank(normalizedAddress),
      ]);

      return NextResponse.json({
        highScore,
        rank,
      });
    }

    const topScores = await getTopScores(10);
    return NextResponse.json(topScores);
  } catch (error) {
    console.error('Leaderboard GET error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body?.address || typeof body.address !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'address is required' },
        { status: 400 }
      );
    }

    if (typeof body.score !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'score must be a number' },
        { status: 400 }
      );
    }

    const normalizedAddress = body.address.toLowerCase();

    const entry: LeaderboardEntry = {
      address: normalizedAddress,
      username:
        typeof body.username === 'string' && body.username.trim()
          ? body.username.trim()
          : formatAddress(normalizedAddress),
      displayName:
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim()
          : formatAddress(normalizedAddress),
      pfpUrl: typeof body.pfpUrl === 'string' ? body.pfpUrl : '',
      score: body.score,
      level: typeof body.level === 'number' ? body.level : 1,
      lines: typeof body.lines === 'number' ? body.lines : 0,
      timestamp: typeof body.timestamp === 'number' ? body.timestamp : Date.now(),
    };

    await saveScore(entry);
    const rank = await getUserRank(normalizedAddress);

    return NextResponse.json({
      ok: true,
      rank,
    });
  } catch (error) {
    console.error('Leaderboard POST error:', error);
    return NextResponse.json(
      { ok: false, error: 'failed to save leaderboard entry' },
      { status: 500 }
    );
  }
}
