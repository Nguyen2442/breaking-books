import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listAllBooksAsync, setBookHiddenState, deleteBookAsync, enqueueBook } from '@/lib/books';

export const dynamic = 'force-dynamic';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('bb_admin_session');
  return session?.value === 'authenticated_admin_ok';
}

export async function GET() {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const books = await listAllBooksAsync({ includeHidden: true });
  return NextResponse.json({ ok: true, books });
}

export async function POST(req) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, bookId, isHidden, chapters } = body;

    if (action === 'toggle-visibility') {
      if (!bookId) return NextResponse.json({ ok: false, error: 'Thiếu bookId' }, { status: 400 });
      const targetHidden = typeof isHidden !== 'undefined' ? Boolean(isHidden) : Boolean(body.hidden);
      const ok = setBookHiddenState(bookId, targetHidden);
      return NextResponse.json({ ok, isHidden: targetHidden });
    }

    if (action === 'delete') {
      if (!bookId) return NextResponse.json({ ok: false, error: 'Thiếu bookId' }, { status: 400 });
      const res = await deleteBookAsync(bookId);
      return NextResponse.json(res);
    }

    if (action === 'reprocess') {
      if (!bookId) return NextResponse.json({ ok: false, error: 'Thiếu bookId' }, { status: 400 });
      const res = enqueueBook(bookId, chapters);
      return NextResponse.json({ ok: true, ...res });
    }

    return NextResponse.json({ ok: false, error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
