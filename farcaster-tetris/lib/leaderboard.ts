import { createClient } from '@vercel/kv';

export interface LeaderboardEntry {
  address: string;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  score: number;
  level: number;
  lines: number;
  timestamp: number;
}

type MemoryStore = {
  entries: Record<string, LeaderboardEntry>;
};

declare global {
  // eslint-disable-next-line no-var
  var __fartetrisLeaderboardStore__: MemoryStore | undefined;
}

const kvConfigured =
  !!process.env.KV2_KV_REST_API_URL && !!process.env.KV2_KV_REST_API_TOKEN;

const kv = kvConfigured
  ? createClient({
      url: process.env.KV2_KV_REST_API_URL!,
      token: process.env.KV2_KV_REST_API_TOKEN!,
    })
  : null;

const memoryStore: MemoryStore =
  globalThis.__fartetrisLeaderboardStore__ ??
  (globalThis.__fartetrisLeaderboardStore__ = {
    entries: {},
  });

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

export async function saveScore(entry: LeaderboardEntry): Promise<void> {
  const normalizedAddress = normalizeAddress(entry.address);
  const normalizedEntry: LeaderboardEntry = {
    ...entry,
    address: normalizedAddress,
  };

  if (kv) {
    const key = `leaderboard:${normalizedAddress}`;
    const existingEntry = await kv.get<LeaderboardEntry>(key);

    if (!existingEntry || normalizedEntry.score > existingEntry.score) {
      await kv.set(key, normalizedEntry);
      await kv.zadd('leaderboard:ranking', {
        score: normalizedEntry.score,
        member: normalizedAddress,
      });
    }
    return;
  }

  const existingEntry = memoryStore.entries[normalizedAddress];
  if (!existingEntry || normalizedEntry.score > existingEntry.score) {
    memoryStore.entries[normalizedAddress] = normalizedEntry;
  }
}

export async function getTopScores(limit: number = 10): Promise<LeaderboardEntry[]> {
  if (kv) {
    const topAddresses = await kv.zrange('leaderboard:ranking', 0, limit - 1, {
      rev: true,
    });

    if (!topAddresses || topAddresses.length === 0) {
      return [];
    }

    const entries: LeaderboardEntry[] = [];
    for (const address of topAddresses) {
      const entry = await kv.get<LeaderboardEntry>(`leaderboard:${address}`);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  return Object.values(memoryStore.entries)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.timestamp - b.timestamp;
    })
    .slice(0, limit);
}

export async function getUserRank(address: string): Promise<number | null> {
  const normalizedAddress = normalizeAddress(address);

  if (kv) {
    const rank = await kv.zrevrank('leaderboard:ranking', normalizedAddress);
    return rank !== null ? rank + 1 : null;
  }

  const sorted = Object.values(memoryStore.entries).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.timestamp - b.timestamp;
  });

  const index = sorted.findIndex(
    (entry) => normalizeAddress(entry.address) === normalizedAddress
  );

  return index >= 0 ? index + 1 : null;
}

export async function getUserHighScore(address: string): Promise<LeaderboardEntry | null> {
  const normalizedAddress = normalizeAddress(address);

  if (kv) {
    const entry = await kv.get<LeaderboardEntry>(`leaderboard:${normalizedAddress}`);
    return entry ?? null;
  }

  return memoryStore.entries[normalizedAddress] ?? null;
}
