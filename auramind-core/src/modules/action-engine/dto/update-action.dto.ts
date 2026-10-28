import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ActionStatus } from '@prisma/client';

export class UpdateActionDto {
  @IsOptional()
  @IsEnum(ActionStatus, {
    message: 'Trạng thái hành động phải là PENDING, IN_PROGRESS, COMPLETED hoặc SKIPPED.',
  })
  status?: ActionStatus;

  @IsOptional()
  @IsString()
  reflectionNotes?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class ActivateActionsDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  chapterId: string;
}

