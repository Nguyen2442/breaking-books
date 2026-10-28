import { NextResponse } from 'next/server';
import { listAllBooks, getChapterPayload } from '@/lib/books';
import { isDbAvailable, syncBookFilesToDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDbAvailable()) {
    return NextResponse.json({
      ok: false,
      message: 'Chưa cấu hình DATABASE_URL trong biến môi trường.',
    }, { status: 400 });
  }

  try {
    const books = listAllBooks();
    const results = [];
    let totalSynced = 0;

    for (const book of books) {
      const count = await syncBookFilesToDb(book, getChapterPayload);
      results.push({ bookId: book.id, title: book.title, syncedChapters: count });
      totalSynced += count;
    }

    return NextResponse.json({
      ok: true,
      message: `Đã đồng bộ thành công ${totalSynced} chương sách thành cấu trúc JSONB vào PostgreSQL Database!`,
      totalSynced,
      books: results,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
