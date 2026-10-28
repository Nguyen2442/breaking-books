import { NextResponse } from 'next/server';
import { createNewBook, listPdfFiles } from '@/lib/books';
import { getCurrentUser } from '@/lib/user-auth';

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const pdfFile = body.pdfFile || body.pdfPath || listPdfFiles()[0]?.name;
    const book = await createNewBook({
      ...body,
      pdfFile,
      ownerId: user?.id || body.ownerId || null,
    });
    return NextResponse.json({ ok: true, bookId: book.id, book });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}
