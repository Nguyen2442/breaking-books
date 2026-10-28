import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, getChapterPayload, buildChapterPrompt, prioritizeChapter } from '@/lib/books';
import { getChapterFromDb, saveChapterToDb, isDbAvailable } from '@/lib/db';
import { parseHtmlJsToJsonb, jsonbToHtmlAndJs } from '@/lib/chapter-jsonb';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { bookId, chNum } = await params;
  const num = Number(chNum);

  // 1. Check PostgreSQL DB first if DATABASE_URL is available
  if (isDbAvailable()) {
    try {
      const dbChapter = await getChapterFromDb(bookId, num);
      if (dbChapter && dbChapter.content) {
        const { html, js } = jsonbToHtmlAndJs(dbChapter.content);
        return NextResponse.json({
          ok: true,
          source: 'db',
          book: dbChapter.book || { id: bookId, title: bookId },
          ch: {
            n: num,
            num,
            id: `ch${num}`,
            title: dbChapter.title,
            vi: dbChapter.title,
            status: dbChapter.status,
          },
          content: dbChapter.content,
          html,
          js,
        });
      }
    } catch (e) {
      console.warn(`[API] DB lookup fallback to file:`, e.message);
    }
  }

  // 2. Fallback to file-based chapter payload
  const payload = getChapterPayload(bookId, num);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Chapter not found' }, { status: 404 });
  }

  // If this chapter is still pending/processing, prioritize it to the very front of the AI write queue!
  if (payload.ch.status !== 'complete') {
    try {
      prioritizeChapter(bookId, num);
    } catch {}
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'auto';
  const includeText = url.searchParams.get('text') === '1';

  const prompt = buildChapterPrompt(payload.book, payload.ch, mode);
  let sourceText = '';
  if ((includeText || !payload.html) && payload.ch.textPath) {
    try {
      sourceText = readFileSync(join(ROOT, bookId, payload.ch.textPath), 'utf8').slice(0, 60000);
    } catch { /* ignore */ }
  }

  // 3. Build rich JSONB structure from HTML/JS
  const content = parseHtmlJsToJsonb({
    html: payload.html,
    js: payload.js,
    chMeta: payload.ch,
    bookTitle: payload.book.title,
  });

  // 4. Opportunistically sync to PostgreSQL DB in background if DB is connected
  if (isDbAvailable()) {
    saveChapterToDb({
      bookId,
      bookTitle: payload.book.title,
      chapterNumber: num,
      chapterTitle: payload.ch.vi || payload.ch.title || `Chương ${num}`,
      contentJsonb: content,
      rawText: payload.html,
      contentHash: `file-hash-${bookId}-ch${num}`,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    source: 'file',
    book: payload.book,
    ch: payload.ch,
    content,
    html: payload.html,
    js: payload.js,
    prompt,
    sourceText,
  });
}
