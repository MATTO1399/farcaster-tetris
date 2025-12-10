import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 入力検証スキーマ
const notificationSchema = z.object({
  fid: z.number().positive().int(),
  message: z.string().min(1).max(500),
  type: z.enum(['score', 'achievement', 'system']).optional(),
});

type NotificationRequest = z.infer<typeof notificationSchema>;

// レート制限（ユーザーごと）
const userRequestCounts = new Map<number, { count: number; resetTime: number }>();
const USER_RATE_LIMIT_WINDOW = 60 * 1000; // 1分
const USER_RATE_LIMIT_MAX = 5; // 5通知/分

function checkUserRateLimit(fid: number): boolean {
  const now = Date.now();
  const record = userRequestCounts.get(fid);

  if (!record || now > record.resetTime) {
    userRequestCounts.set(fid, {
      count: 1,
      resetTime: now + USER_RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (record.count >= USER_RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

// メッセージのサニタイゼーション
function sanitizeMessage(message: string): string {
  // HTMLタグの除去
  return message
    .replace(/<[^>]*>/g, '')
    .trim()
    .substring(0, 500);
}

export async function POST(req: NextRequest) {
  try {
    // 1. Content-Type検証
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    // 2. リクエストボディの取得とサイズ制限
    const rawBody = await req.text();
    if (rawBody.length > 10 * 1024) { // 10KB制限
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }

    // 3. JSONパース
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // 4. スキーマ検証
    const validationResult = notificationSchema.safeParse(body);
    if (!validationResult.success) {
      console.warn('[Notify] Validation failed:', validationResult.error);
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { fid, message, type = 'system' } = validationResult.data;

    // 5. ユーザーごとのレート制限
    if (!checkUserRateLimit(fid)) {
      return NextResponse.json(
        { error: 'Too many notifications. Please try again later.' },
        { status: 429 }
      );
    }

    // 6. メッセージのサニタイゼーション
    const sanitizedMessage = sanitizeMessage(message);
    if (sanitizedMessage.length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty after sanitization' },
        { status: 400 }
      );
    }

    // 7. 通知の送信（実装例）
    // TODO: 実際のFarcaster Notification APIを使用
    console.log('[Notify] Sending notification:', {
      fid,
      type,
      messageLength: sanitizedMessage.length,
      timestamp: new Date().toISOString(),
    });

    // 実際の実装例：
    /*
    const notificationResponse = await fetch('https://api.farcaster.xyz/v2/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FARCASTER_API_KEY}`,
      },
      body: JSON.stringify({
        fid,
        message: sanitizedMessage,
        type,
      }),
    });

    if (!notificationResponse.ok) {
      throw new Error('Failed to send notification');
    }
    */

    // 8. 成功レスポンス
    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
    });

  } catch (error) {
    // エラーログ（詳細は内部のみ）
    console.error('[Notify] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    // クライアントには詳細を返さない
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

// 他のHTTPメソッドは拒否
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
