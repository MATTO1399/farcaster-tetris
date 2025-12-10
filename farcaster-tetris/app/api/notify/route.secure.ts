// app/api/notify/route.secure.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 通知リクエストのバリデーションスキーマ
const notificationSchema = z.object({
  fid: z.number().int().positive(),
  message: z.string().min(1),
  type: z.enum(['score', 'achievement', 'system']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // リクエストボディのバリデーション
    const validationResult = notificationSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: validationResult.error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { fid, message, type = 'system' } = validationResult.data;

    // TODO: 実際の通知送信ロジックを実装
    console.log(`Sending notification to FID ${fid}: ${message} (type: ${type})`);

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
    });

  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
