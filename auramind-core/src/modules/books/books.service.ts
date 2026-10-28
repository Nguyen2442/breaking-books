import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import * as pdfParse from 'pdf-parse';
import { GeminiService } from '../ai/gemini.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface ChunkedChapter {
  chapterNumber: number;
  title: string;
  rawText: string;
  wordCount: number;
}

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    @InjectQueue('book-processing-queue') private readonly bookQueue: Queue,
    private readonly geminiService: GeminiService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Receive raw uploaded book PDF, extract text, divide into standard chapters (2,000 - 4,000 words)
   * and enqueue background jobs asynchronously.
   */
  async processUploadedBook(file: Express.Multer.File, title?: string, author?: string, userId?: string) {
    this.logger.log(`Parsing uploaded PDF: "${file.originalname}" (${(file.size / 1024 / 1024).toFixed(2)} MB)...`);

    // 1. Parse PDF text
    const pdfData = await pdfParse(file.buffer);
    const fullText = pdfData.text || '';
    const bookTitle = title || file.originalname.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');

    // 2. Chunk text into chapters (2,000 - 4,000 words each)
    const rawChapters = this.chunkTextIntoChapters(fullText);
    this.logger.log(`Tách được ${rawChapters.length} chương chuẩn từ "${bookTitle}".`);

    // 3. Create Book record in PostgreSQL
    const book = await this.prisma.book.create({
      data: {
        userId: userId || null,
        title: bookTitle,
        author: author || 'Unknown Author',
        pageCount: pdfData.numpages || 0,
        totalWords: fullText.split(/\s+/).length,
        status: 'PROCESSING',
      },
    });

    // 4. Create Chapter records & dispatch tasks to BullMQ
    const chapterJobs = [];
    for (const ch of rawChapters) {
      const normalized = ch.rawText.trim().replace(/\s+/g, ' ');
      const contentHash = crypto.createHash('sha256').update(normalized).digest('hex');

      const chapterRecord = await this.prisma.chapter.create({
        data: {
          bookId: book.id,
          chapterNumber: ch.chapterNumber,
          title: ch.title,
          rawText: ch.rawText,
          wordCount: ch.wordCount,
          contentHash,
          status: 'PENDING',
        },
      });

      // Add to BullMQ with exponential backoff for 429 rate limit resilience
      const job = await this.bookQueue.add(
        'process-chapter',
        {
          chapterId: chapterRecord.id,
          bookId: book.id,
          chapterNumber: ch.chapterNumber,
          chapterTitle: ch.title,
          bookTitle: book.title,
          rawText: ch.rawText,
        },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5s, 10s, 20s, 40s, 80s
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        }
      );

      chapterJobs.push({ chapterId: chapterRecord.id, jobId: job.id });
    }

    return {
      bookId: book.id,
      title: book.title,
      totalChapters: rawChapters.length,
      pageCount: pdfData.numpages,
      status: 'PROCESSING',
      queuedJobs: chapterJobs.length,
      message: 'Sách đã được tiếp nhận và chia chương thành công. Pipeline bóc tách đang xử lý ngầm qua BullMQ.',
    };
  }

  /**
   * Intelligently divides raw book text by chapter headings or word budget (2,000 - 4,000 words)
   */
  private chunkTextIntoChapters(text: string): ChunkedChapter[] {
    const lines = text.split('\n');
    const chapters: ChunkedChapter[] = [];
    
    // Regex matching "Chapter 1", "Chương 1", "Phần 1", "CHAPTER I", etc.
    const chapterRegex = /^(?:chapter|chương|part|phần)\s+([0-9ivxlcdm]+)[:.\s]*(.*)$/i;

    let currentChapterNum = 1;
    let currentTitle = 'Mở đầu & Tổng quan';
    let currentLines: string[] = [];

    for (const line of lines) {
      const match = line.trim().match(chapterRegex);
      const isWordLimitExceeded = currentLines.join(' ').split(/\s+/).length >= 3500;

      if ((match || isWordLimitExceeded) && currentLines.length > 200) {
        const rawContent = currentLines.join('\n').trim();
        chapters.push({
          chapterNumber: currentChapterNum,
          title: currentTitle,
          rawText: rawContent,
          wordCount: rawContent.split(/\s+/).length,
        });

        currentChapterNum++;
        currentTitle = match ? (match[2]?.trim() || `Chương ${match[1]}`) : `Phần ${currentChapterNum}`;
        currentLines = [];
      }

      currentLines.push(line);
    }

    if (currentLines.length > 0) {
      const rawContent = currentLines.join('\n').trim();
      chapters.push({
        chapterNumber: currentChapterNum,
        title: currentTitle,
        rawText: rawContent,
        wordCount: rawContent.split(/\s+/).length,
      });
    }

    return chapters;
  }

  /**
   * Query book details including all chapter decomposition progress
   */
  async getBookDetails(bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        chapters: {
          select: {
            id: true,
            chapterNumber: true,
            title: true,
            wordCount: true,
            status: true,
            isCached: true,
            tokensUsed: true,
            aiModelUsed: true,
            updatedAt: true,
          },
          orderBy: { chapterNumber: 'asc' },
        },
      },
    });

    if (!book) throw new NotFoundException(`Không tìm thấy cuốn sách với ID: ${bookId}`);
    return book;
  }

  /**
   * Get single chapter with full JSONB structured knowledge
   */
  async getChapterContent(chapterId: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        book: { select: { id: true, title: true, author: true } },
      },
    });

    if (!chapter) throw new NotFoundException(`Không tìm thấy chương với ID: ${chapterId}`);
    return chapter;
  }

  /**
   * Semantic Cross-Book Vector Search via pgvector
   */
  async semanticSearch(query: string, limit: number = 5) {
    this.logger.log(`Thực hiện Semantic Search pgvector cho câu hỏi: "${query}"...`);
    const embedding = await this.geminiService.generateEmbedding(query);
    const vectorString = `[${embedding.join(',')}]`;

    // Execute raw SQL using cosine distance operator (<=>)
    const results: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
          ce.id,
          ce."chunkText",
          c."chapterNumber",
          c.title AS "chapterTitle",
          b.id AS "bookId",
          b.title AS "bookTitle",
          1 - (ce.embedding <=> $1::vector) AS similarity
       FROM chapter_embeddings ce
       JOIN chapters c ON c.id = ce."chapterId"
       JOIN books b ON b.id = c."bookId"
       ORDER BY ce.embedding <=> $1::vector ASC
       LIMIT $2`,
      vectorString,
      limit
    );

    return results;
  }
}
