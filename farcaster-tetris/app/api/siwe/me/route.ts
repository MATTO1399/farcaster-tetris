export const dynamic = 'force-dynamic';
import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'fartetris_siwe_session';

type SessionPayload = {
  address: string;
  chainId: number;
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.SIWE_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SIWE_SESSION_SECRET is missing or too short');
  }
  return secret;
}

function sign(value: string) {
  return createHmac('sha256', getSessionSecret())
    .update(value)
    .digest('base64url');
}

function decodeSession(cookieValue: string | undefined): SessionPayload | null {
  if (!cookieValue) return null;

  const [encoded, receivedSignature] = cookieValue.split('.');
  if (!encoded || !receivedSignature) return null;

  const expectedSignature = sign(encoded);

  const a = Buffer.from(receivedSignature);
  const b = Buffer.from(expectedSignature);

  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as SessionPayload;

    if (!payload.address || !payload.chainId || !payload.exp) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(sessionCookie);

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        address: null,
        chainId: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      address: session.address,
      chainId: session.chainId,
    });
  } catch (error) {
    console.error('SIWE me error:', error);

    return NextResponse.json(
      {
        authenticated: false,
        address: null,
        chainId: null,
      },
      { status: 200 }
    );
  }
}
