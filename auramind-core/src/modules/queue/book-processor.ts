import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as crypto from 'crypto';
import { GeminiService } from '../ai/gemini.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface ProcessChapterJobPayload {
  chapterId: string;
  bookId: string;
  chapterNumber: number;
  chapterTitle: string;
  bookTitle: string;
  rawText: string;
}

@Processor('book-processing-queue', {
  concurrency: 3, // Safe concurrency limit to avoid triggering AI provider 429 rate limits
})
export class BookProcessor extends WorkerHost {
  private readonly logger = new Logger(BookProcessor.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<ProcessChapterJobPayload>): Promise<any> {
    const { chapterId, bookId, chapterNumber, chapterTitle, bookTitle, rawText } = job.data;
    this.logger.log(`[Job ${job.id}] Bắt đầu bóc tách Chương ${chapterNumber}: "${chapterTitle}" (${rawText.length} ký tự)...`);

    // 1. Mark chapter status as PROCESSING
    await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { status: 'PROCESSING', errorMessage: null },
    });

    try {
      // 2. Compute SHA-256 Content Hash for Global Caching Layer
      const normalizedText = rawText.trim().replace(/\s+/g, ' ');
      const contentHash = crypto.createHash('sha256').update(normalizedText).digest('hex');

      // 3. Global Caching Layer Lookup (Cost = 0đ, Latency = 0ms)
      const cachedChapter = await this.prisma.chapter.findFirst({
        where: {
          contentHash,
          status: 'COMPLETED',
          content: { not: null },
          id: { not: chapterId }, // Exclude self
        },
        select: {
          id: true,
          content: true,
          aiModelUsed: true,
        },
      });

      if (cachedChapter && cachedChapter.content) {
        this.logger.log(
          `⚡ [GLOBAL CACHE HIT] Trùng khớp SHA-256 hash (${contentHash.slice(0, 10)}...). Kế thừa trực tiếp tri thức từ Chapter ${cachedChapter.id}. Chi phí AI: 0đ!`
        );

        await this.prisma.chapter.update({
          where: { id: chapterId },
          data: {
            content: cachedChapter.content as any,
            contentHash,
            isCached: true,
            cachedFromId: cachedChapter.id,
            tokensUsed: 0,
            aiModelUsed: `cached:${cachedChapter.aiModelUsed || 'gemini'}`,
            status: 'COMPLETED',
          },
        });

        // Check if all chapters in book are completed to update Book status
        await this.checkAndFinalizeBook(bookId);
        return { success: true, cached: true, sourceChapterId: cachedChapter.id };
      }

      // 4. Cache Miss: Execute Gemini 3.5 AI Decomposition Pipeline
      job.updateProgress(30);
      const { data: structuredContent, tokens, modelUsed } = await this.geminiService.decomposeChapter(
        chapterNumber,
        chapterTitle,
        rawText,
        bookTitle
      );

      job.updateProgress(70);

      // 5. Generate Vector Embedding for Semantic Search / Cross-Book RAG
      this.logger.log(`Tạo Vector Embedding 768-D cho Chương ${chapterNumber}...`);
      let embeddingVector: number[] = [];
      try {
        const textToEmbed = `${structuredContent.title}\n\n${structuredContent.coreSummary}\n\n${structuredContent.simplifiedExplanation.keyTakeaway}`;
        embeddingVector = await this.geminiService.generateEmbedding(textToEmbed);
      } catch (embErr: any) {
        this.logger.warn(`Lỗi tạo embedding (vẫn tiếp tục lưu content): ${embErr.message}`);
      }

      // 6. Persist Structured Content and Vector Embedding into PostgreSQL
      await this.prisma.chapter.update({
        where: { id: chapterId },
        data: {
          content: structuredContent as any,
          contentHash,
          isCached: false,
          tokensUsed: tokens,
          aiModelUsed: modelUsed,
          status: 'COMPLETED',
        },
      });

      // Save vector embedding if available using raw SQL for pgvector compatibility
      if (embeddingVector.length > 0) {
        const vectorString = `[${embeddingVector.join(',')}]`;
        const chunkText = structuredContent.coreSummary;
        
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO chapter_embeddings (id, "chapterId", "chunkIndex", "chunkText", embedding, "createdAt")
           VALUES (gen_random_uuid(), $1, 0, $2, $3::vector, NOW())`,
          chapterId,
          chunkText,
          vectorString
        );
      }

      job.updateProgress(100);
      this.logger.log(`✅ [Job ${job.id}] Hoàn thành bóc tách Chương ${chapterNumber} (${tokens} tokens).`);

      // 7. Check if all chapters of book are ready
      await this.checkAndFinalizeBook(bookId);

      return { success: true, cached: false, tokens, modelUsed };
    } catch (error: any) {
      this.logger.error(`❌ [Job ${job.id}] Thất bại tại Chương ${chapterNumber}: ${error.message}`);

      await this.prisma.chapter.update({
        where: { id: chapterId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });

      throw error; // Re-throw to let BullMQ trigger automatic retry with exponential backoff
    }
  }

  /**
   * Updates Book status to READY once every chapter has finished processing
   */
  private async checkAndFinalizeBook(bookId: string): Promise<void> {
    const chapters = await this.prisma.chapter.findMany({
      where: { bookId },
      select: { status: true },
    });

    const allCompleted = chapters.length > 0 && chapters.every((c) => c.status === 'COMPLETED');
    if (allCompleted) {
      await this.prisma.book.update({
        where: { id: bookId },
        data: { status: 'READY' },
      });
      this.logger.log(`🎉 [Book ${bookId}] Toàn bộ các chương đã hoàn thành! Trạng thái sách chuyển thành READY.`);
    }
  }
}
