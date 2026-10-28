import { NextResponse } from 'next/server';
import { createNewBook, enqueueBook } from '@/lib/books';

export const dynamic = 'force-dynamic';

// Body: { bookId } to (re)start writing unfinished chapters, optionally { chapters: [n] };
//       { pdfFile } to turn a PDF already in books/ into a new book and start writing it.
export async function POST(request) {
  try {
    const body = await request.json();
    let bookId = body.bookId;
    if (!bookId && body.pdfFile) bookId = createNewBook({ pdfFile: body.pdfFile }).id;
    if (!bookId) throw new Error('Thiếu bookId hoặc pdfFile.');
    const state = enqueueBook(bookId, body.chapters);
    return NextResponse.json({ ok: true, bookId, ...state });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}
