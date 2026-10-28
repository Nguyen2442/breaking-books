import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ReviewFlashcardDto {
  @IsString()
  @IsNotEmpty()
  cardId: string;

  /**
   * SuperMemo-2 Recall Quality score (0 to 5):
   * 0: Hoàn toàn không nhớ gì (Blackout)
   * 1: Nhớ sai sau khi nhìn đáp án
   * 2: Nhớ mang máng nhưng vẫn sai
   * 3: Nhớ đúng nhưng phải suy nghĩ rất lâu (Khó)
   * 4: Nhớ đúng sau một chút do dự
   * 5: Nhớ ngay lập tức một cách hoàn hảo (Dễ)
   */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  quality: number;
}

export class ActivateDeckDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  chapterId: string;
}

