import { PrismaClient } from '@prisma/client';
import { parseHtmlJsToJsonb, jsonbToHtmlAndJs } from './chapter-jsonb.js';

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
 * Executes separate individual statements to avoid PostgreSQL Code 42601:
 * "cannot insert multiple commands into a prepared statement".
 */
export async function ensureTablesExist() {
  if (tablesEnsured) return true;
  const prisma = getPrisma();
  if (!prisma) return false;

  const statements = [
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    `DO $$ BEGIN
       CREATE TYPE "BookStatus" AS ENUM ('PENDING', 'PARSING', 'PROCESSING', 'READY', 'FAILED');
     EXCEPTION
       WHEN duplicate_object THEN null;
     END $$;`,
    `DO $$ BEGIN
       CREATE TYPE "ChapterStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
     EXCEPTION
       WHEN duplicate_object THEN null;
     END $$;`,
    `CREATE TABLE IF NOT EXISTS books (
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
    )`,
    `CREATE TABLE IF NOT EXISTS chapters (
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
    )`,
    `CREATE TABLE IF NOT EXISTS chapter_embeddings (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "chapterId" TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      "chunkIndex" INTEGER NOT NULL,
      "chunkText" TEXT NOT NULL,
      metadata JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS "idx_chapters_content_hash" ON chapters ("contentHash")',
    'CREATE INDEX IF NOT EXISTS "idx_chapters_bookId" ON chapters ("bookId")',
    'CREATE INDEX IF NOT EXISTS "idx_chapters_status" ON chapters ("status")',
    'CREATE INDEX IF NOT EXISTS "idx_chapters_content_gin" ON chapters USING gin (content jsonb_path_ops)'
  ];

  let hasErrors = false;
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      // Ignore extension or index warning if vector/uuid or GIN is not supported on standard PG
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        console.warn('[DB Auto-DDL Statement Notice]:', err.message);
      }
    }
  }

  tablesEnsured = true;
  console.log('[DB] Khởi tạo cấu trúc bảng PostgreSQL thành công (Single-statement DDL)!');
  return true;
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
 * Save new or existing book with its chapters to PostgreSQL
 */
export async function saveBookToDb({
  id,
  title,
  author = '',
  coverUrl = '',
  sourceFile = '',
  pageCount = 0,
  status = 'PROCESSING',
  chapters = [],
}) {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    await ensureTablesExist();

    const book = await prisma.book.upsert({
      where: { id },
      update: {
        title,
        author: author || undefined,
        coverUrl: coverUrl || undefined,
        sourceFile: sourceFile || undefined,
        pageCount: pageCount || undefined,
        status: status || 'PROCESSING',
      },
      create: {
        id,
        title,
        author: author || '',
        coverUrl: coverUrl || '',
        sourceFile: sourceFile || '',
        pageCount: pageCount || 0,
        status: status || 'PROCESSING',
      },
    });

    for (const ch of chapters) {
      const chNum = Number(ch.n || ch.chapterNumber || 1);
      const chTitle = ch.vi || ch.title || ch.en || `Chương ${chNum}`;
      await prisma.chapter.upsert({
        where: {
          bookId_chapterNumber: {
            bookId: id,
            chapterNumber: chNum,
          },
        },
        update: {
          title: chTitle,
          rawText: ch.rawText || undefined,
        },
        create: {
          bookId: id,
          chapterNumber: chNum,
          title: chTitle,
          contentHash: ch.contentHash || `init-${id}-${chNum}`,
          rawText: ch.rawText || null,
          status: 'PENDING',
        },
      });
    }

    return book;
  } catch (err) {
    console.warn(`[DB] saveBookToDb(${id}) failed:`, err.message);
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
        content: contentJsonb || undefined,
        rawText: rawText || undefined,
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
 * Retrieve all books stored in PostgreSQL DB and format them into standard Book info
 */
export async function getAllBooksFromDb() {
  const prisma = getPrisma();
  if (!prisma) return [];

  try {
    await ensureTablesExist();
    const dbBooks = await prisma.book.findMany({
      include: {
        chapters: {
          orderBy: { chapterNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return dbBooks.map((b) => {
      const chapters = (b.chapters || []).map((c) => ({
        n: c.chapterNumber,
        num: c.chapterNumber,
        id: `ch${c.chapterNumber}`,
        en: c.title,
        vi: c.title,
        title: c.title,
        subtitle: c.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Đang xử lý...',
        status: c.status === 'COMPLETED' ? 'complete' : 'pending',
        hasHtml: Boolean(c.content),
        hasJs: Boolean(c.content),
        hasText: Boolean(c.rawText),
        topicsCount: c.content?.topics?.length || 0,
        topicCount: c.content?.topics?.length || 0,
        svgCount: c.content?.topics?.length || 0,
        quizCount: c.content?.quizzes?.length || 0,
        topics: (c.content?.topics || []).map((t, idx) => ({
          n: t.num || `${c.chapterNumber}.${idx + 1}`,
          title: t.title,
          short: t.short || t.title,
        })),
        htmlWidgets: [],
        jsWidgets: [],
        missingWidgets: [],
        htmlTermsCount: 0,
        jsTermsCount: 0,
      }));

      const completeCount = chapters.filter((c) => c.status === 'complete').length;
      const totalTopics = chapters.reduce((s, c) => s + c.topicsCount, 0);
      const totalQuizzes = chapters.reduce((s, c) => s + c.quizCount, 0);

      return {
        id: b.id,
        title: b.title,
        shortTitle: b.title,
        subtitle: b.author ? `Tác giả: ${b.author}` : '',
        author: b.author || '',
        coverUrl: b.coverUrl || `/covers/${b.id}.jpg`,
        edition: b.pageCount ? `${b.pageCount} trang` : '',
        description: `Sổ tay đọc tương tác cho ${b.title}`,
        sourcePdfs: b.sourceFile ? [b.sourceFile] : [],
        distExists: false,
        distSize: 0,
        completeCount,
        partialCount: 0,
        totalChapters: chapters.length,
        totalTopics,
        totalWidgets: totalTopics,
        totalQuizzes,
        stats: {
          completeChapters: completeCount,
          partialChapters: 0,
          totalChapters: chapters.length,
          totalTopics,
          totalSvgs: totalTopics,
          totalQuizzes,
        },
        chapters,
        fromDb: true,
      };
    });
  } catch (err) {
    console.warn('[DB] getAllBooksFromDb failed:', err.message);
    return [];
  }
}

/**
 * Retrieve single book by ID from PostgreSQL DB
 */
export async function getBookFromDb(bookId) {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    await ensureTablesExist();
    const b = await prisma.book.findUnique({
      where: { id: bookId },
      include: {
        chapters: {
          orderBy: { chapterNumber: 'asc' },
        },
      },
    });
    if (!b) return null;

    const chapters = (b.chapters || []).map((c) => ({
      n: c.chapterNumber,
      num: c.chapterNumber,
      id: `ch${c.chapterNumber}`,
      en: c.title,
      vi: c.title,
      title: c.title,
      subtitle: c.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Đang xử lý...',
      status: c.status === 'COMPLETED' ? 'complete' : 'pending',
      hasHtml: Boolean(c.content),
      hasJs: Boolean(c.content),
      hasText: Boolean(c.rawText),
      topicsCount: c.content?.topics?.length || 0,
      topicCount: c.content?.topics?.length || 0,
      svgCount: c.content?.topics?.length || 0,
      quizCount: c.content?.quizzes?.length || 0,
      topics: (c.content?.topics || []).map((t, idx) => ({
        n: t.num || `${c.chapterNumber}.${idx + 1}`,
        title: t.title,
        short: t.short || t.title,
      })),
      htmlWidgets: [],
      jsWidgets: [],
      missingWidgets: [],
      htmlTermsCount: 0,
      jsTermsCount: 0,
      rawText: c.rawText,
      content: c.content,
    }));

    const completeCount = chapters.filter((c) => c.status === 'complete').length;
    const totalTopics = chapters.reduce((s, c) => s + c.topicsCount, 0);
    const totalQuizzes = chapters.reduce((s, c) => s + c.quizCount, 0);

    return {
      id: b.id,
      title: b.title,
      shortTitle: b.title,
      subtitle: b.author ? `Tác giả: ${b.author}` : '',
      author: b.author || '',
      coverUrl: b.coverUrl || `/covers/${b.id}.jpg`,
      edition: b.pageCount ? `${b.pageCount} trang` : '',
      description: `Sổ tay đọc tương tác cho ${b.title}`,
      sourcePdfs: b.sourceFile ? [b.sourceFile] : [],
      distExists: false,
      distSize: 0,
      completeCount,
      partialCount: 0,
      totalChapters: chapters.length,
      totalTopics,
      totalWidgets: totalTopics,
      totalQuizzes,
      stats: {
        completeChapters: completeCount,
        partialChapters: 0,
        totalChapters: chapters.length,
        totalTopics,
        totalSvgs: totalTopics,
        totalQuizzes,
      },
      chapters,
      fromDb: true,
    };
  } catch (err) {
    console.warn(`[DB] getBookFromDb(${bookId}) failed:`, err.message);
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
