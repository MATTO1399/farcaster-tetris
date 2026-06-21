import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';

const NONCE_COOKIE_NAME = 'fartetris_siwe_nonce';
const SESSION_COOKIE_NAME = 'fartetris_siwe_session';
const SESSION_MAX_AGE = 60 * 60 * 24; // 1日

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

function encodeSession(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

function getRequestHost(request: NextRequest) {
  return request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, signature } = body ?? {};

    if (!message || !signature) {
      return NextResponse.json(
        { ok: false, error: 'message and signature are required' },
        { status: 400 }
      );
    }

    const nonce = request.cookies.get(NONCE_COOKIE_NAME)?.value;
    if (!nonce) {
      return NextResponse.json(
        { ok: false, error: 'nonce cookie not found' },
        { status: 400 }
      );
    }

    const host = getRequestHost(request);
    if (!host) {
      return NextResponse.json(
        { ok: false, error: 'host header not found' },
        { status: 400 }
      );
    }

    const siweMessage = new SiweMessage(message);

    const result = await siweMessage.verify({
      signature,
      nonce,
      domain: host,
    });

    const sessionPayload: SessionPayload = {
      address: result.data.address.toLowerCase(),
      chainId: result.data.chainId,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    };

    const sessionValue = encodeSession(sessionPayload);

    const response = NextResponse.json({
      ok: true,
      address: sessionPayload.address,
      chainId: sessionPayload.chainId,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionValue,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    response.cookies.set({
      name: NONCE_COOKIE_NAME,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('SIWE verify error:', error);

    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'SIWE verification failed';

    return NextResponse.json(
      { ok: false, error: message },
      { status: 401 }
    );
  }
}
