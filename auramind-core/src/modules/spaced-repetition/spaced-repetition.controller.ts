import { Controller, Post, Get, Body, Query, Headers, BadRequestException } from '@nestjs/common';
import { SpacedRepetitionService } from './spaced-repetition.service';
import { ReviewFlashcardDto, ActivateDeckDto } from './dto/review-flashcard.dto';

@Controller('spaced-repetition')
export class SpacedRepetitionController {
  constructor(private readonly srService: SpacedRepetitionService) {}

  /**
   * Activate flashcards from a decomposed chapter into user's review loop
   */
  @Post('activate')
  async activateDeck(@Body() dto: ActivateDeckDto) {
    return await this.srService.activateChapterDeck(dto);
  }

  /**
   * Get all flashcards due for review today
   */
  @Get('due')
  async getDueReviews(
    @Query('userId') userIdQuery?: string,
    @Headers('x-user-id') userIdHeader?: string,
    @Query('limit') limit?: number
  ) {
    const userId = userIdQuery || userIdHeader;
    if (!userId) {
      throw new BadRequestException('Vui lòng cung cấp "userId" qua query param hoặc header x-user-id.');
    }
    return await this.srService.getDueReviews(userId, limit ? Number(limit) : 20);
  }

  /**
   * Submit flashcard review grade (SM-2)
   */
  @Post('review')
  async submitReview(
    @Body() dto: ReviewFlashcardDto,
    @Query('userId') userIdQuery?: string,
    @Headers('x-user-id') userIdHeader?: string
  ) {
    const userId = userIdQuery || userIdHeader;
    if (!userId) {
      throw new BadRequestException('Vui lòng cung cấp "userId" để lưu vết ôn tập.');
    }
    return await this.srService.submitReview(userId, dto);
  }

  /**
   * Get retention metrics and stats
   */
  @Get('stats')
  async getStats(
    @Query('userId') userIdQuery?: string,
    @Headers('x-user-id') userIdHeader?: string
  ) {
    const userId = userIdQuery || userIdHeader;
    if (!userId) {
      throw new BadRequestException('Vui lòng cung cấp "userId".');
    }
    return await this.srService.getRetentionStats(userId);
  }
}

