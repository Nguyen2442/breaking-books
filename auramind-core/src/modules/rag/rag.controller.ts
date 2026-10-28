import { Controller, Post, Body, Get, Query, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { RagService } from './rag.service';
import { CrossBookQueryDto } from './dto/cross-book-query.dto';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  /**
   * Cross-Book Knowledge Graph RAG Query
   * Synthesizes answers by comparing multiple authors and books.
   */
  @Post('cross-book')
  @HttpCode(HttpStatus.OK)
  async queryCrossBook(@Body() dto: CrossBookQueryDto) {
    if (!dto.query || dto.query.trim().length === 0) {
      throw new BadRequestException('Vui lòng nhập câu hỏi truy vấn tri thức.');
    }
    return await this.ragService.queryCrossBook(dto);
  }

  /**
   * Quick semantic search endpoint with HTTP GET
   */
  @Get('cross-book')
  async queryCrossBookGet(
    @Query('q') q: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: number
  ) {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException('Tham số "q" không được để trống.');
    }
    return await this.ragService.queryCrossBook({
      query: q,
      userId,
      limit: limit ? Number(limit) : 8,
    });
  }
}

