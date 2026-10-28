import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, getChapterPayload, buildChapterPrompt } from '@/lib/books';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { bookId, chNum } = await params;
  const payload = getChapterPayload(bookId, chNum);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Chapter not found' }, { status: 404 });
  }
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'auto';
  const includeText = url.searchParams.get('text') === '1';

  const prompt = buildChapterPrompt(payload.book, payload.ch, mode);
  let sourceText = '';
  if (includeText && payload.ch.textPath) {
    try {
      sourceText = readFileSync(join(ROOT, bookId, payload.ch.textPath), 'utf8').slice(0, 60000);
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    ok: true,
    book: payload.book,
    ch: payload.ch,
    html: payload.html,
    js: payload.js,
    prompt,
    sourceText,
  });
}
