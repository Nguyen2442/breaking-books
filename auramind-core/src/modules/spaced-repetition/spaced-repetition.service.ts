import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RustEngineClient } from '../../common/rust-engine.client';
import { ReviewFlashcardDto, ActivateDeckDto } from './dto/review-flashcard.dto';

@Injectable()
export class SpacedRepetitionService {
  private readonly logger = new Logger(SpacedRepetitionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rustEngine: RustEngineClient
  ) {}

  /**
   * Activate & materialize Flashcards from Chapter JSONB knowledge into user's Spaced Repetition loop
   */
  async activateChapterDeck(dto: ActivateDeckDto) {
    const { userId, chapterId } = dto;

    // 1. Ensure user exists or create automatically
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@auramind.ai`,
        name: `User ${userId.slice(0, 6)}`,
      },
    });

    // 2. Fetch chapter structured content
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { book: { select: { title: true } } },
    });

    if (!chapter) {
      throw new NotFoundException(`Không tìm thấy chương sách ID: ${chapterId}`);
    }

    const content = chapter.content as any;
    const flashcards: Array<{ question: string; answer: string; tip?: string }> =
      content?.flashcards || [];

    if (flashcards.length === 0) {
      throw new BadRequestException('Chương sách này chưa có bộ câu hỏi Flashcard được bóc tách.');
    }

    // 3. Batch create FlashcardReview records if not existing
    let createdCount = 0;
    for (const card of flashcards) {
      const existing = await this.prisma.flashcardReview.findFirst({
        where: {
          userId,
          chapterId,
          question: card.question,
        },
      });

      if (!existing) {
        await this.prisma.flashcardReview.create({
          data: {
            userId,
            chapterId,
            question: card.question,
            answer: card.answer,
            tip: card.tip || null,
            interval: 1, // Start with 1 day
            easeFactor: 2.5, // Standard SM-2 initial ease
            repetitions: 0,
            nextReviewAt: new Date(), // Available immediately
          },
        });
        createdCount++;
      }
    }

    this.logger.log(`Kích hoạt ${createdCount} thẻ Flashcard mới cho User ${userId} từ Chương "${chapter.title}"`);
    return {
      success: true,
      chapterTitle: chapter.title,
      bookTitle: chapter.book.title,
      totalCardsInChapter: flashcards.length,
      newlyActivated: createdCount,
      message: `Đã đưa ${createdCount} thẻ ghi nhớ vào chu kỳ ôn tập ngắt quãng (Spaced Repetition).`,
    };
  }

  /**
   * Get all flashcards due for review today (nextReviewAt <= NOW)
   */
  async getDueReviews(userId: string, limit: number = 20) {
    const now = new Date();

    const dueCards = await this.prisma.flashcardReview.findMany({
      where: {
        userId,
        nextReviewAt: { lte: now },
      },
      include: {
        chapter: {
          select: {
            chapterNumber: true,
            title: true,
            book: { select: { id: true, title: true, author: true } },
          },
        },
      },
      orderBy: { nextReviewAt: 'asc' },
      take: limit,
    });

    const totalDueCount = await this.prisma.flashcardReview.count({
      where: {
        userId,
        nextReviewAt: { lte: now },
      },
    });

    return {
      userId,
      totalDueToday: totalDueCount,
      cardsInBatch: dueCards.length,
      cards: dueCards.map((card) => ({
        id: card.id,
        question: card.question,
        answer: card.answer,
        tip: card.tip,
        chapterNumber: card.chapter.chapterNumber,
        chapterTitle: card.chapter.title,
        bookTitle: card.chapter.book.title,
        author: card.chapter.book.author,
        repetitions: card.repetitions,
        interval: card.interval,
        easeFactor: card.easeFactor,
      })),
    };
  }

  /**
   * Submit flashcard review grade and recompute next interval using SM-2
   */
  async submitReview(userId: string, dto: ReviewFlashcardDto) {
    const card = await this.prisma.flashcardReview.findFirst({
      where: { id: dto.cardId, userId },
    });

    if (!card) {
      throw new NotFoundException(`Không tìm thấy thẻ Flashcard ID: ${dto.cardId} của người dùng.`);
    }

    // High-speed SM-2 Calculation via Rust Engine (with TypeScript fallback)
    const calculation = await this.rustEngine.calculateSm2(
      card.id,
      dto.quality,
      card.repetitions,
      card.interval,
      card.easeFactor
    );

    // Compute next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + calculation.nextIntervalDays);

    const updated = await this.prisma.flashcardReview.update({
      where: { id: card.id },
      data: {
        repetitions: calculation.nextRepetitions,
        interval: calculation.nextIntervalDays,
        easeFactor: calculation.nextEaseFactor,
        nextReviewAt: nextReviewDate,
        lastReviewedAt: new Date(),
      },
    });

    return {
      cardId: updated.id,
      qualityScore: dto.quality,
      reviewStatus: calculation.reviewStatus,
      previousInterval: card.interval,
      nextIntervalDays: updated.interval,
      nextEaseFactor: updated.easeFactor,
      nextReviewDate: updated.nextReviewAt,
      message:
        dto.quality >= 3
          ? `Xuất sắc! Khái niệm này sẽ được nhắc lại sau ${updated.interval} ngày nữa.`
          : `Khái niệm khó! Thẻ đã được chuyển về trạng thái ôn tập lại vào ngày mai.`,
    };
  }

  /**
   * User learning retention analytics
   */
  async getRetentionStats(userId: string) {
    const totalCards = await this.prisma.flashcardReview.count({ where: { userId } });
    const now = new Date();
    const dueToday = await this.prisma.flashcardReview.count({
      where: { userId, nextReviewAt: { lte: now } },
    });
    const masteredCards = await this.prisma.flashcardReview.count({
      where: { userId, repetitions: { gte: 3 } },
    });

    const retentionScore = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

    return {
      userId,
      totalCards,
      dueToday,
      masteredCards,
      retentionScore: `${retentionScore}%`,
      status: retentionScore > 70 ? 'Excellent Long-term Retention' : 'Building Habit',
    };
  }
}

