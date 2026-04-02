import { NextResponse } from 'next/server';

const NONCE_COOKIE_NAME = 'fartetris_siwe_nonce';
const SESSION_COOKIE_NAME = 'fartetris_siwe_session';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: NONCE_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}
