import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('bb_admin_session');
  const authenticated = session?.value === 'authenticated_admin_ok';
  return NextResponse.json({ authenticated });
}

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const cookieStore = await cookies();
      cookieStore.set('bb_admin_session', 'authenticated_admin_ok', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
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
  cookieStore.delete('bb_admin_session');
  return NextResponse.json({ ok: true });
}
