import { PrismaClient } from '@prisma/client';
import { parseHtmlJsToJsonb } from './chapter-jsonb.js';

let prismaInstance = null;
let tablesEnsured = false;

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
 * Auto-DDL: Self-healing database initialization.
 * Automatically creates books, chapters, and embeddings tables if they don't exist yet,
 * eliminating "The table public.books does not exist" errors on fresh databases.
 */
export async function ensureTablesExist() {
  if (tablesEnsured) return true;
  const prisma = getPrisma();
  if (!prisma) return false;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      DO $$ BEGIN
        CREATE TYPE "BookStatus" AS ENUM ('PENDING', 'PARSING', 'PROCESSING', 'READY', 'FAILED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "ChapterStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title TEXT NOT NULL,
        author TEXT,
        isbn TEXT,
        "coverUrl" TEXT,
        "pageCount" INTEGER DEFAULT 0,
        "totalWords" INTEGER DEFAULT 0,
        status "BookStatus" DEFAULT 'PENDING',
        "sourceFile" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "bookId" TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        "chapterNumber" INTEGER NOT NULL,
        title TEXT NOT NULL,
        "contentHash" VARCHAR(64) NOT NULL DEFAULT '',
        "rawText" TEXT,
        "wordCount" INTEGER DEFAULT 0,
        content JSONB,
        status "ChapterStatus" DEFAULT 'PENDING',
        "errorMessage" TEXT,
        "isCached" BOOLEAN DEFAULT false,
        "cachedFromId" TEXT,
        "aiModelUsed" TEXT,
        "tokensUsed" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chapters_bookId_chapterNumber_key" UNIQUE ("bookId", "chapterNumber")
      );

      CREATE TABLE IF NOT EXISTS chapter_embeddings (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "chapterId" TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        "chunkIndex" INTEGER NOT NULL,
        "chunkText" TEXT NOT NULL,
        metadata JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "idx_chapters_content_hash" ON chapters ("contentHash");
      CREATE INDEX IF NOT EXISTS "idx_chapters_bookId" ON chapters ("bookId");
    `);

    // GIN index for JSONB
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_chapters_content_gin" ON chapters USING gin (content jsonb_path_ops);
      `);
    } catch {}

    tablesEnsured = true;
    console.log('[DB] Khởi tạo cấu trúc bảng books và chapters trong PostgreSQL thành công!');
    return true;
  } catch (err) {
    console.warn('[DB] Tự động khởi tạo bảng thất bại (sẽ fallback file):', err.message);
    return false;
  }
}

/**
 * Get chapter data from PostgreSQL JSONB
 */
export async function getChapterFromDb(bookId, chNum) {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    await ensureTablesExist();
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
    await ensureTablesExist();

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

  await ensureTablesExist();
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
