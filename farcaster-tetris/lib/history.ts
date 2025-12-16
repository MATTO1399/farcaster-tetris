import { kv } from '@vercel/kv';

export interface HistoryEntry {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  score: number;
  level: number;
  lines: number;
  timestamp: number;
}

const MAX_HISTORY_ENTRIES = 10;

export async function saveHistory(entry: HistoryEntry): Promise<void> {
  const key = `history:${entry.fid}`;
  
  // 既存の履歴を取得
  const existingHistory = await kv.get<HistoryEntry[]>(key) || [];
  
  // 新しいエントリを先頭に追加
  const updatedHistory = [entry, ...existingHistory];
  
  // 最大10件まで保持
  const trimmedHistory = updatedHistory.slice(0, MAX_HISTORY_ENTRIES);
  
  // 保存
  await kv.set(key, trimmedHistory);
}

export async function getHistory(fid: number): Promise<HistoryEntry[]> {
  const key = `history:${fid}`;
  const history = await kv.get<HistoryEntry[]>(key);
  return history || [];
}
