import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('Webhook received:', body);

    // Webhookの検証（本番環境では必須）
    const signature = req.headers.get('x-farcaster-signature');
    // ここで署名検証を実装

    // イベントタイプに応じた処理
    switch (body.event) {
      case 'frame.added':
        console.log('App was added by user:', body.data.fid);
        break;
      case 'frame.removed':
        console.log('App was removed by user:', body.data.fid);
        break;
      case 'notifications.enabled':
        console.log('Notifications enabled for user:', body.data.fid);
        break;
      case 'notifications.disabled':
        console.log('Notifications disabled for user:', body.data.fid);
        break;
      default:
        console.log('Unknown event:', body.event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
