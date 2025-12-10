import { NextRequest, NextResponse } from 'next/server';

// 通知送信API（オプション）
export async function POST(req: NextRequest) {
  try {
    const { fid, message } = await req.json();

    if (!fid || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Farcaster通知APIを使用して通知を送信
    // 実装例：ハイスコア達成時の通知など
    
    console.log(`Sending notification to FID ${fid}: ${message}`);

    // TODO: 実際の通知送信ロジック

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
