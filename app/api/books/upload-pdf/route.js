import { NextResponse } from 'next/server';
import { writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { BOOKS_PDF_DIR, listPdfFiles } from '@/lib/books';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let safeName = `upload-${Date.now()}.pdf`;
    let buffer;

    if (contentType.includes('multipart/form-data')) {
      const fd = await request.formData();
      const file = fd.get('file');
      if (!file) throw new Error('Không tìm thấy file đính kèm.');
      safeName = basename(file.name || safeName).replace(/[^a-zA-Z0-9._ -]/g, '_');
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const rawName = request.headers.get('x-filename')
        ? decodeURIComponent(request.headers.get('x-filename'))
        : safeName;
      safeName = basename(rawName).replace(/[^a-zA-Z0-9._ -]/g, '_');
      buffer = Buffer.from(await request.arrayBuffer());
    }

    writeFileSync(join(BOOKS_PDF_DIR, safeName), buffer);
    return NextResponse.json({
      ok: true,
      file: safeName,
      pdfPath: safeName,
      pdfs: listPdfFiles(),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
