import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, getChapterPayload, buildChapterPrompt, prioritizeChapter } from '@/lib/books';
import { getChapterFromDb, getBookFromDb, saveChapterToDb, isDbAvailable } from '@/lib/db';
import { parseHtmlJsToJsonb, jsonbToHtmlAndJs } from '@/lib/chapter-jsonb';

export const dynamic = 'force-dynamic';

// High-Speed In-Memory Cache (0ms latency for completed chapters)
const MEMORY_CACHE = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function invalidateChapterCache(bookId, chNum) {
  if (bookId && chNum) {
    MEMORY_CACHE.delete(`${bookId}:${chNum}`);
  } else if (bookId) {
    for (const key of MEMORY_CACHE.keys()) {
      if (key.startsWith(`${bookId}:`)) MEMORY_CACHE.delete(key);
    }
  } else {
    MEMORY_CACHE.clear();
  }
}

export async function GET(request, { params }) {
  const { bookId, chNum } = await params;
  const num = Number(chNum);
  const cacheKey = `${bookId}:${num}`;

  // 0. Super-fast In-Memory Cache Check (< 1ms)
  const cached = MEMORY_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return NextResponse.json(cached.payload, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        'X-BreakingBooks-Cache': 'MEMORY-HIT',
      },
    });
  }

  // 1. Check PostgreSQL DB first if DATABASE_URL is available
  if (isDbAvailable()) {
    try {
      const dbChapter = await getChapterFromDb(bookId, num);
      if (dbChapter) {
        if (dbChapter.content) {
          let { html, js } = jsonbToHtmlAndJs(dbChapter.content, num);

          // Fallback to local chN.js if DB rawJs was empty
          if (!js || js.trim().length === 0) {
            const localJsPath = join(ROOT, bookId, 'src', `ch${num}.js`);
            if (existsSync(localJsPath)) {
              try { js = readFileSync(localJsPath, 'utf8'); } catch {}
            }
          }

          const responsePayload = {
            ok: true,
            source: 'db',
            book: dbChapter.book || { id: bookId, title: bookId },
            ch: {
              n: num,
              num,
              id: `ch${num}`,
              title: dbChapter.title,
              vi: dbChapter.title,
              status: dbChapter.status === 'COMPLETED' ? 'complete' : 'pending',
            },
            content: dbChapter.content,
            html,
            js,
          };

          if (dbChapter.status === 'COMPLETED') {
            MEMORY_CACHE.set(cacheKey, { payload: responsePayload, timestamp: Date.now() });
          }

          return NextResponse.json(responsePayload, {
            headers: {
              'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
              'X-BreakingBooks-Cache': 'DB-HIT',
            },
          });
        } else {
          // Chapter is still pending or processing in background
          try {
            prioritizeChapter(bookId, num);
          } catch {}
          let rawSource = dbChapter.rawText || '';
          if (!rawSource || rawSource.trim().length === 0) {
            const diskTxt = join(ROOT, bookId, 'text', `ch${num}.txt`);
            if (existsSync(diskTxt)) {
              try { rawSource = readFileSync(diskTxt, 'utf8'); } catch {}
            }
          }

          return NextResponse.json({
            ok: true,
            source: 'db-pending',
            book: dbChapter.book || { id: bookId, title: bookId },
            ch: {
              n: num,
              num,
              id: `ch${num}`,
              title: dbChapter.title,
              vi: dbChapter.title,
              status: 'pending',
            },
            sourceText: rawSource,
            html: '',
            js: '',
          });
        }
      }
    } catch (e) {
      console.warn(`[API] DB lookup fallback to file:`, e.message);
    }
  }

  // 2. Fallback to file-based chapter payload
  let payload = getChapterPayload(bookId, num);

  // If local file not found, try to look up book in DB
  if (!payload && isDbAvailable()) {
    try {
      const dbBook = await getBookFromDb(bookId);
      if (dbBook) {
        const ch = dbBook.chapters.find((c) => c.n === num);
        if (ch) {
          try {
            prioritizeChapter(bookId, num);
          } catch {}
          return NextResponse.json({
            ok: true,
            source: 'db-fallback',
            book: dbBook,
            ch,
            sourceText: ch.rawText || '',
            html: '',
            js: '',
          });
        }
      }
    } catch {}
  }

  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Không tìm thấy chương này trong thư viện.' }, { status: 404 });
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
  const candidateTxtPaths = [
    payload.ch.textPath,
    join('text', `ch${num}.txt`),
    join('text', `ch${payload.ch.n}.txt`),
    join('text', `ch0${num}.txt`),
  ].filter(Boolean);

  for (const rel of candidateTxtPaths) {
    const full = join(ROOT, bookId, rel);
    if (existsSync(full)) {
      try {
        sourceText = readFileSync(full, 'utf8');
        if (sourceText && sourceText.trim().length > 0) break;
      } catch { /* ignore */ }
    }
  }

  // 3. Build rich JSONB structure from HTML/JS
  const content = parseHtmlJsToJsonb({
    html: payload.html,
    js: payload.js,
    chMeta: payload.ch,
    bookTitle: payload.book.title,
  });

  // 4. Opportunistically sync to PostgreSQL DB in background if DB is connected
  if (isDbAvailable() && payload.html) {
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

  const filePayload = {
    ok: true,
    source: 'file',
    book: payload.book,
    ch: payload.ch,
    content,
    html: payload.html,
    js: payload.js,
    prompt,
    sourceText,
  };

  if (payload.ch.status === 'complete') {
    MEMORY_CACHE.set(cacheKey, { payload: filePayload, timestamp: Date.now() });
  }

  return NextResponse.json(filePayload, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'X-BreakingBooks-Cache': 'FILE-HIT',
    },
  });
}
