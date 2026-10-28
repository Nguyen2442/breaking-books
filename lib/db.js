import { PrismaClient } from '@prisma/client';
import { parseHtmlJsToJsonb } from './chapter-jsonb.js';

let prismaInstance = null;

/**
 * Returns Prisma Client singleton if DATABASE_URL is set, otherwise null.
 */
export function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
}

export function isDbAvailable() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Get chapter data from PostgreSQL JSONB
 */
export async function getChapterFromDb(bookId, chNum) {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const chapter = await prisma.chapter.findFirst({
      where: {
        bookId,
        chapterNumber: Number(chNum),
      },
      include: {
        book: true,
      },
    });

    if (!chapter) return null;
    return chapter;
  } catch (err) {
    console.warn(`[DB] getChapterFromDb(${bookId}, ${chNum}) failed:`, err.message);
    return null;
  }
}

/**
 * Upsert chapter with structured JSONB content into PostgreSQL
 */
export async function saveChapterToDb({
  bookId,
  bookTitle,
  chapterNumber,
  chapterTitle,
  contentJsonb,
  rawText = '',
  contentHash = '',
  modelUsed = 'gemini-3.5-flash',
  tokensUsed = 0,
}) {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    // 1. Ensure Book exists
    await prisma.book.upsert({
      where: { id: bookId },
      update: {
        title: bookTitle || bookId,
        status: 'PROCESSING',
      },
      create: {
        id: bookId,
        title: bookTitle || bookId,
        status: 'PROCESSING',
      },
    });

    // 2. Upsert Chapter
    const chapter = await prisma.chapter.upsert({
      where: {
        bookId_chapterNumber: {
          bookId,
          chapterNumber: Number(chapterNumber),
        },
      },
      update: {
        title: chapterTitle || `Chương ${chapterNumber}`,
        content: contentJsonb,
        rawText: rawText || null,
        contentHash: contentHash || `hash-${Date.now()}`,
        status: 'COMPLETED',
        aiModelUsed: modelUsed,
        tokensUsed,
        updatedAt: new Date(),
      },
      create: {
        bookId,
        chapterNumber: Number(chapterNumber),
        title: chapterTitle || `Chương ${chapterNumber}`,
        content: contentJsonb,
        rawText: rawText || null,
        contentHash: contentHash || `hash-${Date.now()}`,
        status: 'COMPLETED',
        aiModelUsed: modelUsed,
        tokensUsed,
      },
    });

    return chapter;
  } catch (err) {
    console.warn(`[DB] saveChapterToDb failed:`, err.message);
    return null;
  }
}

/**
 * Sync all file-based chapters of a book into PostgreSQL JSONB
 */
export async function syncBookFilesToDb(bookMeta, getChapterFn) {
  const prisma = getPrisma();
  if (!prisma || !bookMeta) return 0;

  let synced = 0;
  for (const ch of bookMeta.chapters || []) {
    try {
      const data = getChapterFn(bookMeta.id, ch.n);
      if (data && (data.html || data.js)) {
        const jsonb = parseHtmlJsToJsonb({
          html: data.html,
          js: data.js,
          chMeta: ch,
          bookTitle: bookMeta.title,
        });

        await saveChapterToDb({
          bookId: bookMeta.id,
          bookTitle: bookMeta.title,
          chapterNumber: ch.n,
          chapterTitle: ch.vi || ch.title || `Chương ${ch.n}`,
          contentJsonb: jsonb,
          rawText: data.html,
          contentHash: `file-hash-${bookMeta.id}-ch${ch.n}`,
        });
        synced++;
      }
    } catch (e) {
      console.warn(`Sync failed for ${bookMeta.id} ch ${ch.n}:`, e.message);
    }
  }
  return synced;
}
