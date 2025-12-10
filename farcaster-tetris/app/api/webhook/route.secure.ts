import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Webhook署名検証
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // タイミング攻撃を防ぐため、timingSafeEqualを使用
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    return false;
  }
}

// イベントタイプの検証
const VALID_EVENTS = [
  'frame.added',
  'frame.removed',
  'notifications.enabled',
  'notifications.disabled',
] as const;

type ValidEvent = typeof VALID_EVENTS[number];

function isValidEvent(event: string): event is ValidEvent {
  return VALID_EVENTS.includes(event as ValidEvent);
}

// レート制限用の簡易実装（本番環境ではRedisなどを使用）
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15分
const RATE_LIMIT_MAX = 100; // 100リクエスト/15分

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(identifier);

  if (!record || now > record.resetTime) {
    requestCounts.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 1. レート制限チェック
    const clientIp = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // 2. Content-Type検証
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    // 3. リクエストボディの取得
    const rawBody = await req.text();
    
    // 4. ボディサイズ制限（1MB）
    if (rawBody.length > 1024 * 1024) {
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }

    // 5. 署名検証
    const signature = req.headers.get('x-farcaster-signature');
    const secret = process.env.FARCASTER_WEBHOOK_SECRET;

    if (!secret) {
      console.error('FARCASTER_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!signature) {
      console.warn('Missing signature in webhook request');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      console.warn('Invalid webhook signature', { clientIp });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 6. JSONパース（検証済み）
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // 7. イベントタイプ検証
    if (!body.event || !isValidEvent(body.event)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // 8. FID検証（存在チェック）
    if (!body.data || typeof body.data.fid !== 'number') {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      );
    }

    // 9. イベント処理（ログのみ、本番環境ではデータベースに保存など）
    const safeLog = {
      event: body.event,
      fid: body.data.fid,
      timestamp: new Date().toISOString(),
    };

    switch (body.event) {
      case 'frame.added':
        console.log('[Webhook] App added:', safeLog);
        // TODO: データベースに保存、分析、ウェルカムメッセージ送信など
        break;

      case 'frame.removed':
        console.log('[Webhook] App removed:', safeLog);
        // TODO: データベースから削除、フィードバック収集など
        break;

      case 'notifications.enabled':
        console.log('[Webhook] Notifications enabled:', safeLog);
        // TODO: 通知設定の有効化
        break;

      case 'notifications.disabled':
        console.log('[Webhook] Notifications disabled:', safeLog);
        // TODO: 通知設定の無効化
        break;

      default:
        // TypeScriptの型システムでここには到達しないはず
        console.warn('[Webhook] Unknown event:', body.event);
    }

    // 10. 成功レスポンス
    return NextResponse.json({ success: true });

  } catch (error) {
    // エラーログ（詳細は内部のみ）
    console.error('[Webhook] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    // クライアントには詳細を返さない
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GETリクエストは拒否
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
