import { IsString, IsNotEmpty, IsOptional, IsArray, IsInt, Min, Max, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CrossBookQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'Câu hỏi hoặc chủ đề truy vấn không được để trống.' })
  query: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bookIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 8;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number = 0.45;
}

export interface RelevantChunk {
  embeddingId: string;
  chunkText: string;
  similarity: number;
  chapterNumber: number;
  chapterTitle: string;
  bookId: string;
  bookTitle: string;
  author: string;
}

export interface GroupedPerspective {
  bookId: string;
  bookTitle: string;
  author: string;
  relevantExcerpts: string[];
}

export interface CrossBookRagResponse {
  query: string;
  synthesizedAnswer: string;
  perspectivesCount: {
    books: number;
    authors: number;
    chunks: number;
  };
  perspectives: GroupedPerspective[];
  citations: Array<{
    bookTitle: string;
    author: string;
    chapterNumber: number;
    chapterTitle: string;
    similarity: number;
  }>;
}
