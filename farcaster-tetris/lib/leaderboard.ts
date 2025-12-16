import { kv } from '@vercel/kv';

export interface LeaderboardEntry {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  score: number;
  level: number;
  lines: number;
  timestamp: number;
}

// スコアを保存
export async function saveScore(entry: LeaderboardEntry): Promise<void> {
  const key = `leaderboard:${entry.fid}`;
  
  // 既存のハイスコアを取得
  const existingEntry = await kv.get<LeaderboardEntry>(key);
  
  // 新しいスコアが高い場合のみ更新
  if (!existingEntry || entry.score > existingEntry.score) {
    await kv.set(key, entry);
    
    // ランキング用のソート済みセットに追加
    await kv.zadd('leaderboard:ranking', {
      score: entry.score,
      member: entry.fid.toString(),
    });
  }
}

// トップ10を取得
export async function getTopScores(limit: number = 10): Promise<LeaderboardEntry[]> {
  // スコアの高い順に取得
  const topFids = await kv.zrange('leaderboard:ranking', 0, limit - 1, {
    rev: true, // 降順
  });
  
  if (!topFids || topFids.length === 0) {
    return [];
  }
  
  // 各ユーザーの詳細情報を取得
  const entries: LeaderboardEntry[] = [];
  for (const fid of topFids) {
    const entry = await kv.get<LeaderboardEntry>(`leaderboard:${fid}`);
    if (entry) {
      entries.push(entry);
    }
  }
  
  return entries;
}

// 自分のランキングを取得
export async function getUserRank(fid: number): Promise<number | null> {
  const rank = await kv.zrevrank('leaderboard:ranking', fid.toString());
  return rank !== null ? rank + 1 : null; // 1-indexed
}

// 自分のハイスコアを取得
export async function getUserHighScore(fid: number): Promise<LeaderboardEntry | null> {
  return await kv.get<LeaderboardEntry>(`leaderboard:${fid}`);
}
