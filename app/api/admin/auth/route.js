import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createSessionToken,
  isAdminAuthenticated,
  verifyCredentials,
} from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authenticated = await isAdminAuthenticated();
  return NextResponse.json({ authenticated });
}

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    if (verifyCredentials(username, password)) {
      const cookieStore = await cookies();
      cookieStore.set(ADMIN_COOKIE, createSessionToken(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: ADMIN_SESSION_MAX_AGE,
      });
      return NextResponse.json({ ok: true, message: 'Đăng nhập thành công' });
    }
    return NextResponse.json(
      { ok: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác' },
      { status: 401 }
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}
