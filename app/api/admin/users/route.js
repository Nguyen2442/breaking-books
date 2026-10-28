import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import {
  getAllUsers,
  toggleUserStatus,
  resetUserPassword,
  deleteUserAccount,
} from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isAuth = await isAdminAuthenticated();
  if (!isAuth) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const users = await getAllUsers();
  return NextResponse.json({ ok: true, users });
}

export async function POST(req) {
  const isAuth = await isAdminAuthenticated();
  if (!isAuth) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, userId, newPassword } = body;

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Thiếu userId' }, { status: 400 });
    }

    if (action === 'toggle-status') {
      const res = await toggleUserStatus(userId);
      return NextResponse.json(res);
    }

    if (action === 'reset-password') {
      const res = await resetUserPassword(userId, newPassword);
      return NextResponse.json(res);
    }

    if (action === 'delete-user') {
      const res = await deleteUserAccount(userId);
      return NextResponse.json(res);
    }

    return NextResponse.json({ ok: false, error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
