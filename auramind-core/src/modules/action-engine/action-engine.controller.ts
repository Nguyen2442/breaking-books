import { Controller, Post, Get, Patch, Body, Param, Query, Headers, BadRequestException } from '@nestjs/common';
import { ActionEngineService } from './action-engine.service';
import { UpdateActionDto, ActivateActionsDto } from './dto/update-action.dto';
import { ActionStatus } from '@prisma/client';

@Controller('action-engine')
export class ActionEngineController {
  constructor(private readonly actionService: ActionEngineService) {}

  /**
   * Activate actionable steps from a chapter into active user action items
   */
  @Post('activate')
  async activateActions(@Body() dto: ActivateActionsDto) {
    return await this.actionService.activateChapterActions(dto);
  }

  /**
   * Get list of user action items, optionally filtered by status
   */
  @Get('items')
  async getUserActions(
    @Query('userId') userIdQuery?: string,
    @Headers('x-user-id') userIdHeader?: string,
    @Query('status') status?: ActionStatus
  ) {
    const userId = userIdQuery || userIdHeader;
    if (!userId) {
      throw new BadRequestException('Vui lòng cung cấp "userId".');
    }
    return await this.actionService.getUserActions(userId, status);
  }

  /**
   * Update action execution status & log real-world implementation reflections
   */
  @Patch('items/:id')
  async updateAction(
    @Param('id') actionId: string,
    @Body() dto: UpdateActionDto,
    @Query('userId') userIdQuery?: string,
    @Headers('x-user-id') userIdHeader?: string
  ) {
    const userId = userIdQuery || userIdHeader;
    if (!userId) {
      throw new BadRequestException('Vui lòng cung cấp "userId".');
    }
    return await this.actionService.updateAction(userId, actionId, dto);
  }

  /**
   * Get habit execution metrics and progress
   */
  @Get('metrics')
  async getHabitMetrics(
    @Query('userId') userIdQuery?: string,
    @Headers('x-user-id') userIdHeader?: string
  ) {
    const userId = userIdQuery || userIdHeader;
    if (!userId) {
      throw new BadRequestException('Vui lòng cung cấp "userId".');
    }
    return await this.actionService.getHabitMetrics(userId);
  }
}

