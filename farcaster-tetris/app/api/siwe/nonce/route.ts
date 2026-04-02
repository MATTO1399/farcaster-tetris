import { NextResponse } from 'next/server';
import { generateNonce } from 'siwe';

const NONCE_COOKIE_NAME = 'fartetris_siwe_nonce';

export async function GET() {
  const nonce = generateNonce();

  const response = NextResponse.json({ nonce });

  response.cookies.set({
    name: NONCE_COOKIE_NAME,
    value: nonce,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10, // 10分
  });

  return response;
}
