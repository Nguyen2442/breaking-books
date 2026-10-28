import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BooksService } from './books.service';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  /**
   * Upload & Parse PDF Book -> Async Background Queue
   * Responds immediately with HTTP 202 Accepted
   */
  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(pdf|epub)$/i)) {
          return cb(new BadRequestException('Chỉ chấp nhận file định dạng PDF hoặc EPUB.'), false);
        }
        cb(null, true);
      },
    })
  )
  async uploadBook(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
    @Body('author') author?: string
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file sách để tải lên.');
    }

    return await this.booksService.processUploadedBook(file, title, author);
  }

  /**
   * Get overall book details and chapter progress
   */
  @Get(':id')
  async getBook(@Param('id') id: string) {
    return await this.booksService.getBookDetails(id);
  }

  /**
   * Get decomposed chapter content with JSONB knowledge
   */
  @Get('chapters/:id')
  async getChapter(@Param('id') id: string) {
    return await this.booksService.getChapterContent(id);
  }

  /**
   * Cross-book Semantic Vector Search (RAG)
   */
  @Get('search/semantic')
  async search(@Query('q') query: string, @Query('limit') limit?: number) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Tham số tìm kiếm "q" không được để trống.');
    }
    return await this.booksService.semanticSearch(query, limit ? Number(limit) : 5);
  }
}
