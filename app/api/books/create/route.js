import { NextResponse } from 'next/server';
import { createNewBook, listPdfFiles } from '@/lib/books';

export async function POST(request) {
  try {
    const body = await request.json();
    const pdfFile = body.pdfFile || body.pdfPath || listPdfFiles()[0]?.name;
    const book = await createNewBook({ ...body, pdfFile });
    return NextResponse.json({ ok: true, bookId: book.id, book });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}
