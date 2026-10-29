import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authenticateUser, registerUser } from '@/lib/users';
import {
  USER_COOKIE,
  USER_SESSION_MAX_AGE,
  createUserSessionToken,
  getCurrentUser,
  clearSessionCache,
} from '@/lib/user-auth';

export const dynamic = 'force-dynamic';

function getCookieOptions(req) {
  const host = req?.headers?.get('host') || '';
  const proto = req?.headers?.get('x-forwarded-proto') || '';
  const isHttps = proto === 'https';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('192.168.');

  return {
    httpOnly: true,
    secure: isHttps && !isLocal,
    sameSite: 'lax',
    path: '/',
    maxAge: USER_SESSION_MAX_AGE,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ ok: true, user });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, email, password, name } = body;

    if (action === 'register') {
      if (!name || !email || !password) {
        return NextResponse.json(
          { ok: false, error: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu.' },
          { status: 400 }
        );
      }
      const newUser = await registerUser({ name, email, password });
      const token = createUserSessionToken(newUser);

      const cookieStore = await cookies();
      cookieStore.set(USER_COOKIE, token, getCookieOptions(req));

      return NextResponse.json({
        ok: true,
        message: 'Đăng ký tài khoản thành công!',
        user: newUser,
      });
    }

    if (action === 'login') {
      if (!email || !password) {
        return NextResponse.json(
          { ok: false, error: 'Vui lòng nhập email và mật khẩu.' },
          { status: 400 }
        );
      }
      const user = await authenticateUser(email, password);
      if (!user) {
        return NextResponse.json(
          { ok: false, error: 'Email hoặc mật khẩu không chính xác.' },
          { status: 401 }
        );
      }

      const token = createUserSessionToken(user);
      const cookieStore = await cookies();
      cookieStore.set(USER_COOKIE, token, getCookieOptions(req));

      return NextResponse.json({
        ok: true,
        message: 'Đăng nhập thành công!',
        user,
      });
    }

    if (action === 'logout') {
      const cookieStore = await cookies();
      const token = cookieStore.get(USER_COOKIE)?.value;
      if (token) clearSessionCache(token);
      cookieStore.delete({ name: USER_COOKIE, path: '/' });
      return NextResponse.json({ ok: true, message: 'Đã đăng xuất.' });
    }

    return NextResponse.json({ ok: false, error: 'Hành động không hợp lệ.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: USER_COOKIE, path: '/' });
  return NextResponse.json({ ok: true });
}
