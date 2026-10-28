import { PrismaClient } from '@prisma/client';
import { parseHtmlJsToJsonb, jsonbToHtmlAndJs } from './chapter-jsonb.js';
import { KNOWLEDGE_BASE } from './knowledge-base.js';

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
 * Recursively strips null bytes (\u0000 / 0x00) which PostgreSQL strictly forbids in TEXT, VARCHAR and JSONB.
 * Prevents PostgreSQL Error 22021: "invalid byte sequence for encoding UTF8: 0x00".
 */
export function stripNullBytes(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.replace(/[\x00\u0000]/g, '');
  }
  if (Array.isArray(value)) {
    return value.map(stripNullBytes);
  }
  if (typeof value === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(value)) {
      const cleanKey = typeof k === 'string' ? k.replace(/[\x00\u0000]/g, '') : k;
      clean[cleanKey] = stripNullBytes(v);
    }
    return clean;
  }
  return value;
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
    'CREATE INDEX IF NOT EXISTS "idx_chapters_content_gin" ON chapters USING gin (content jsonb_path_ops)',
    `CREATE TABLE IF NOT EXISTS domain_knowledge (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "domainKey" TEXT UNIQUE NOT NULL,
      "nameVi" TEXT NOT NULL,
      "nameEn" TEXT NOT NULL,
      "roleName" TEXT NOT NULL,
      perspective TEXT NOT NULL,
      keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
      "foundationalPrinciples" JSONB DEFAULT '[]'::jsonb,
      "coreGuidance" TEXT NOT NULL,
      "calloutContext" TEXT NOT NULL,
      "keyMetrics" JSONB DEFAULT '[]'::jsonb,
      "widgetLabBlueprint" JSONB,
      "quizContext" TEXT,
      "isActive" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS "idx_domain_knowledge_key" ON domain_knowledge ("domainKey")',
    'CREATE INDEX IF NOT EXISTS "idx_domain_knowledge_active" ON domain_knowledge ("isActive")',
    `CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      key TEXT NOT NULL,
      "domainKey" TEXT,
      version INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      "systemInstruction" TEXT NOT NULL,
      "promptTemplate" TEXT NOT NULL,
      parameters JSONB,
      "isActive" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "prompt_templates_key_domainKey_version_key" UNIQUE (key, "domainKey", version)
    )`,
    'CREATE INDEX IF NOT EXISTS "idx_prompt_templates_key_domain" ON prompt_templates (key, "domainKey")',
    `CREATE TABLE IF NOT EXISTS crawled_terms (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "domainKey" TEXT NOT NULL,
      term TEXT NOT NULL,
      "viTranslation" TEXT,
      definition TEXT,
      "caseStudy" TEXT,
      source TEXT DEFAULT 'crawler',
      confidence DOUBLE PRECISION DEFAULT 1.0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS "idx_crawled_terms_domainKey" ON crawled_terms ("domainKey")',
    'CREATE INDEX IF NOT EXISTS "idx_crawled_terms_term" ON crawled_terms (term)'
  ];

  let hasErrors = false;
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        console.warn('[DB Auto-DDL Statement Notice]:', err.message);
      }
    }
  }

  tablesEnsured = true;
  console.log('[DB] Khởi tạo cấu trúc bảng PostgreSQL thành công (Single-statement DDL)!');

  // Asynchronously seed initial knowledge base if empty
  seedKnowledgeBaseToDb().catch(() => {});

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

    const cleanId = stripNullBytes(id);
    const cleanTitle = stripNullBytes(title);
    const cleanAuthor = stripNullBytes(author);
    const cleanCoverUrl = stripNullBytes(coverUrl);
    const cleanSourceFile = stripNullBytes(sourceFile);

    const book = await prisma.book.upsert({
      where: { id: cleanId },
      update: {
        title: cleanTitle,
        author: cleanAuthor || undefined,
        coverUrl: cleanCoverUrl || undefined,
        sourceFile: cleanSourceFile || undefined,
        pageCount: pageCount || undefined,
        status: status || 'PROCESSING',
      },
      create: {
        id: cleanId,
        title: cleanTitle,
        author: cleanAuthor || '',
        coverUrl: cleanCoverUrl || '',
        sourceFile: cleanSourceFile || '',
        pageCount: pageCount || 0,
        status: status || 'PROCESSING',
      },
    });

    for (const ch of chapters) {
      const chNum = Number(ch.n || ch.chapterNumber || 1);
      const chTitle = stripNullBytes(ch.vi || ch.title || ch.en || `Chương ${chNum}`);
      const chRawText = ch.rawText ? stripNullBytes(ch.rawText) : null;
      const chHash = stripNullBytes(ch.contentHash || `init-${cleanId}-${chNum}`);

      await prisma.chapter.upsert({
        where: {
          bookId_chapterNumber: {
            bookId: cleanId,
            chapterNumber: chNum,
          },
        },
        update: {
          title: chTitle,
          rawText: chRawText || undefined,
        },
        create: {
          bookId: cleanId,
          chapterNumber: chNum,
          title: chTitle,
          contentHash: chHash,
          rawText: chRawText,
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

    const cleanBookId = stripNullBytes(bookId);
    const cleanBookTitle = stripNullBytes(bookTitle || bookId);
    const cleanChTitle = stripNullBytes(chapterTitle || `Chương ${chapterNumber}`);
    const cleanContent = stripNullBytes(contentJsonb);
    const cleanRawText = rawText ? stripNullBytes(rawText) : null;
    const cleanHash = stripNullBytes(contentHash || `hash-${Date.now()}`);
    const cleanModel = stripNullBytes(modelUsed);

    // 1. Ensure Book exists
    await prisma.book.upsert({
      where: { id: cleanBookId },
      update: {
        title: cleanBookTitle,
        status: 'PROCESSING',
      },
      create: {
        id: cleanBookId,
        title: cleanBookTitle,
        status: 'PROCESSING',
      },
    });

    // 2. Upsert Chapter
    const chapter = await prisma.chapter.upsert({
      where: {
        bookId_chapterNumber: {
          bookId: cleanBookId,
          chapterNumber: Number(chapterNumber),
        },
      },
      update: {
        title: cleanChTitle,
        content: cleanContent || undefined,
        rawText: cleanRawText || undefined,
        contentHash: cleanHash,
        status: 'COMPLETED',
        aiModelUsed: cleanModel,
        tokensUsed,
        updatedAt: new Date(),
      },
      create: {
        bookId: cleanBookId,
        chapterNumber: Number(chapterNumber),
        title: cleanChTitle,
        content: cleanContent,
        rawText: cleanRawText,
        contentHash: cleanHash,
        status: 'COMPLETED',
        aiModelUsed: cleanModel,
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

/**
 * Auto-seeds initial 12 professional disciplines from KNOWLEDGE_BASE into PostgreSQL
 */
export async function seedKnowledgeBaseToDb() {
  const prisma = getPrisma();
  if (!prisma) return;

  try {
    const count = await prisma.domainKnowledge.count();
    if (count > 0) return; // Already seeded

    console.log('[DB Knowledge Base] Đang tự động nạp 12 lĩnh vực tri thức nền tảng vào PostgreSQL...');
    for (const [key, d] of Object.entries(KNOWLEDGE_BASE)) {
      await prisma.domainKnowledge.upsert({
        where: { domainKey: key },
        update: {},
        create: {
          domainKey: key,
          nameVi: d.nameVi,
          nameEn: d.nameEn,
          roleName: d.roleName,
          perspective: d.perspective,
          keywords: d.keywords || [],
          foundationalPrinciples: d.foundationalPrinciples || [],
          coreGuidance: d.coreGuidance || '',
          calloutContext: d.calloutContext || '',
          keyMetrics: d.keyMetrics || [],
          widgetLabBlueprint: d.widgetLabBlueprint || {},
          quizContext: d.quizContext || '',
          isActive: true,
        },
      });
    }

    // Also seed default chapter breaking prompt template
    await prisma.promptTemplate.upsert({
      where: {
        key_domainKey_version: {
          key: 'chapter-break',
          domainKey: 'global',
          version: 1,
        },
      },
      update: {},
      create: {
        key: 'chapter-break',
        domainKey: 'global',
        version: 1,
        name: 'Single-Pass Chapter Knowledge Decomposition (Zero-Fluff)',
        systemInstruction: `BẠN LÀ {{roleName}}.
GÓC NHÌN & TIÊU CHUẨN: {{perspective}}.
NGUYÊN TẮC ZERO-FLUFF (TRỰC DIỆN, THỰC CHIẾN, KHÔNG RƯỜM RÀ):
1. VĂN PHONG MẠNH MẼ, TRỰC DIỆN:
   - Triệt tiêu hoàn toàn văn phong dịch máy hoặc lời rào đón ("Trong bài học này chúng ta sẽ tìm hiểu...").
{{coreGuidance}}
2. BỐI CẢNH THỰC TẾ VIỆT NAM:
   - Phần callout BẮT BUỘC: {{calloutContext}}
3. BÀI THỰC HÀNH MÔ PHỎNG (WIDGET LAB) TRỰC QUAN THEO ĐÚNG CHỦ ĐỀ:
{{widgetLabGuidance}}
4. TRẮC NGHIỆM CHUẨN ĐÁNH GIÁ:
   - {{quizContext}}
   - 4 phương án rõ ràng, 1 đáp án đúng (index 0-3), kèm phần explanation phân tích kỹ lưỡng.
5. TRẢ VỀ DUY NHẤT CHUẨN JSON HỢP LỆ THEO YÊU CẦU, KHÔNG KÈM MARKDOWN NÀO KHÁC.`,
        promptTemplate: `Hãy bóc tách tri thức toàn diện của Chương {{targetCh}}: "{{chapterTitle}}" từ cuốn sách "{{bookTitle}}".
Lĩnh vực chuyên môn: {{perspective}}.

Văn bản nguồn của chương:
{{rawText}}

HÃY XUẤT RA DUY NHẤT ĐỊNH DẠNG JSON với cấu trúc chuẩn.`,
        parameters: { temperature: 0.15, maxOutputTokens: 32768, json: true },
        isActive: true,
      },
    });

    console.log('[DB Knowledge Base] ✓ Đã nạp thành công 12 lĩnh vực và mẫu prompt tiêu chuẩn vào PostgreSQL!');
  } catch (err) {
    console.warn('[DB Knowledge Base Seed Notice]:', err.message);
  }
}

/**
 * Gets domain knowledge from DB with fallback to built-in KNOWLEDGE_BASE
 */
export async function getDomainKnowledgeFromDb(domainKey) {
  const prisma = getPrisma();
  if (prisma) {
    try {
      const record = await prisma.domainKnowledge.findUnique({
        where: { domainKey },
      });
      if (record && record.isActive) return record;
    } catch {}
  }
  return KNOWLEDGE_BASE[domainKey] || KNOWLEDGE_BASE.general;
}

/**
 * Gets all active domains from DB with fallback to KNOWLEDGE_BASE
 */
export async function getAllDomainsFromDb() {
  const prisma = getPrisma();
  if (prisma) {
    try {
      const records = await prisma.domainKnowledge.findMany({
        where: { isActive: true },
        orderBy: { nameVi: 'asc' },
      });
      if (records && records.length > 0) return records;
    } catch {}
  }
  return Object.values(KNOWLEDGE_BASE);
}

/**
 * Saves or updates domain knowledge in DB
 */
export async function saveDomainKnowledgeToDb(domainData) {
  const prisma = getPrisma();
  if (!prisma) return null;

  const clean = stripNullBytes(domainData);
  return prisma.domainKnowledge.upsert({
    where: { domainKey: clean.domainKey },
    update: clean,
    create: clean,
  });
}

/**
 * Gets active prompt template from DB for a specific key & domain
 */
export async function getPromptTemplateFromDb(key, domainKey = null) {
  const prisma = getPrisma();
  if (prisma) {
    try {
      if (domainKey) {
        const domainTpl = await prisma.promptTemplate.findFirst({
          where: { key, domainKey, isActive: true },
          orderBy: { version: 'desc' },
        });
        if (domainTpl) return domainTpl;
      }
      const globalTpl = await prisma.promptTemplate.findFirst({
        where: { key, domainKey: 'global', isActive: true },
        orderBy: { version: 'desc' },
      });
      if (globalTpl) return globalTpl;
    } catch {}
  }
  return null;
}

/**
 * Saves a prompt template to DB
 */
export async function savePromptTemplateToDb(templateData) {
  const prisma = getPrisma();
  if (!prisma) return null;

  const clean = stripNullBytes(templateData);
  return prisma.promptTemplate.create({
    data: clean,
  });
}

/**
 * Stores newly crawled or user-submitted keywords / terms
 */
export async function saveCrawledTermToDb(termData) {
  const prisma = getPrisma();
  if (!prisma) return null;

  const clean = stripNullBytes(termData);
  const term = await prisma.crawledTerm.create({
    data: clean,
  });

  try {
    const domain = await prisma.domainKnowledge.findUnique({
      where: { domainKey: clean.domainKey },
    });
    if (domain) {
      const currentKws = Array.isArray(domain.keywords) ? domain.keywords : [];
      if (!currentKws.includes(clean.term.toLowerCase())) {
        await prisma.domainKnowledge.update({
          where: { domainKey: clean.domainKey },
          data: {
            keywords: [...currentKws, clean.term.toLowerCase()],
          },
        });
      }
    }
  } catch {}

  return term;
}
