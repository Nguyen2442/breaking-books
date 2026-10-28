import { NextResponse } from 'next/server';
import { savePdfUpload, createNewBook, enqueueBook } from '@/lib/books';

export const dynamic = 'force-dynamic';

// One step for the user: upload a PDF → split it into chapters → queue Claude to write every chapter.
export async function POST(request) {
  let stage = 'upload';
  try {
    const fd = await request.formData();
    const file = fd.get('file');
    if (!file || typeof file === 'string') throw new Error('Chưa chọn file PDF.');
    const pdfFile = savePdfUpload(file.name, Buffer.from(await file.arrayBuffer()));

    stage = 'split';
    const book = await createNewBook({ pdfFile });

    stage = 'queue';
    let warning = '';
    try {
      enqueueBook(book.id);
    } catch (err) {
      warning = err.message;
    }
    return NextResponse.json({ ok: true, bookId: book.id, title: book.title, chapters: book.totalChapters, warning });
  } catch (err) {
    return NextResponse.json({ ok: false, stage, error: err.message }, { status: 400 });
  }
}
