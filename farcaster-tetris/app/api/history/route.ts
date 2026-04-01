import { NextRequest, NextResponse } from 'next/server';
import { saveHistory, getHistory, type HistoryEntry } from '../../../lib/history';

export async function POST(request: NextRequest) {
  try {
    const entry: HistoryEntry = await request.json();

    if (!entry.address || typeof entry.score !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await saveHistory(entry);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save history:', error);
    return NextResponse.json(
      { error: 'Failed to save history' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Missing address parameter' },
        { status: 400 }
      );
    }

    const history = await getHistory(address);

    return NextResponse.json(history);
  } catch (error) {
    console.error('Failed to get history:', error);
    return NextResponse.json(
      { error: 'Failed to get history' },
      { status: 500 }
    );
  }
}
