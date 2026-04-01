import { createClient } from '@vercel/kv';

const kv = createClient({
  url: process.env.KV2_KV_REST_API_URL!,
  token: process.env.KV2_KV_REST_API_TOKEN!,
});

export interface HistoryEntry {
  address: string;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  score: number;
  level: number;
  lines: number;
  timestamp: number;
}

const MAX_HISTORY_ENTRIES = 10;

export async function saveHistory(entry: HistoryEntry): Promise<void> {
  const normalizedAddress = entry.address.toLowerCase();
  const key = `history:${normalizedAddress}`;

  const existingHistory = (await kv.get<HistoryEntry[]>(key)) || [];

  const updatedHistory = [
    { ...entry, address: normalizedAddress },
    ...existingHistory,
  ];

  const trimmedHistory = updatedHistory.slice(0, MAX_HISTORY_ENTRIES);

  await kv.set(key, trimmedHistory);
}

export async function getHistory(address: string): Promise<HistoryEntry[]> {
  const key = `history:${address.toLowerCase()}`;
  const history = await kv.get<HistoryEntry[]>(key);
  return history || [];
}
