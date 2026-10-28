import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionStatus } from '@prisma/client';
import { UpdateActionDto, ActivateActionsDto } from './dto/update-action.dto';

@Injectable()
export class ActionEngineService {
  private readonly logger = new Logger(ActionEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Materialize actionable directives from decomposed chapter JSONB into active Action Tasks
   */
  async activateChapterActions(dto: ActivateActionsDto) {
    const { userId, chapterId } = dto;

    // Ensure user exists
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@auramind.ai`,
        name: `User ${userId.slice(0, 6)}`,
      },
    });

    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { book: { select: { title: true } } },
    });

    if (!chapter) {
      throw new NotFoundException(`Không tìm thấy chương sách ID: ${chapterId}`);
    }

    const content = chapter.content as any;
    const actionableSteps: Array<{ stepNumber: number; action: string; practicalTips: string }> =
      content?.actionableSteps || [];

    if (actionableSteps.length === 0) {
      throw new BadRequestException('Chương sách này chưa có Actionable Steps được bóc tách.');
    }

    let createdCount = 0;
    for (const step of actionableSteps) {
      const existing = await this.prisma.actionItem.findFirst({
        where: {
          userId,
          chapterId,
          stepNumber: step.stepNumber,
        },
      });

      if (!existing) {
        // Default due date: 7 days from now
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);

        await this.prisma.actionItem.create({
          data: {
            userId,
            chapterId,
            stepNumber: step.stepNumber,
            action: step.action,
            practicalTips: step.practicalTips,
            status: 'PENDING',
            dueDate,
          },
        });
        createdCount++;
      }
    }

    this.logger.log(`Tạo ${createdCount} Action Items cho User ${userId} từ Chương "${chapter.title}"`);
    return {
      success: true,
      chapterTitle: chapter.title,
      bookTitle: chapter.book.title,
      totalActionsInChapter: actionableSteps.length,
      newlyCreated: createdCount,
      message: `Đã đưa ${createdCount} hành động thực thi vào Động cơ Hành động (Action Engine).`,
    };
  }

  /**
   * Get all active action tasks for a user
   */
  async getUserActions(userId: string, status?: ActionStatus) {
    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const actions = await this.prisma.actionItem.findMany({
      where,
      include: {
        chapter: {
          select: {
            chapterNumber: true,
            title: true,
            book: { select: { id: true, title: true, author: true } },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });

    return {
      userId,
      totalCount: actions.length,
      actions: actions.map((item) => ({
        id: item.id,
        stepNumber: item.stepNumber,
        action: item.action,
        practicalTips: item.practicalTips,
        status: item.status,
        dueDate: item.dueDate,
        reflectionNotes: item.reflectionNotes,
        chapterTitle: item.chapter.title,
        bookTitle: item.chapter.book.title,
        author: item.chapter.book.author,
      })),
    };
  }

  /**
   * Update action execution status & log real-world implementation reflections
   */
  async updateAction(userId: string, actionId: string, dto: UpdateActionDto) {
    const action = await this.prisma.actionItem.findFirst({
      where: { id: actionId, userId },
    });

    if (!action) {
      throw new NotFoundException(`Không tìm thấy hành động ID: ${actionId} của người dùng.`);
    }

    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.reflectionNotes !== undefined) data.reflectionNotes = dto.reflectionNotes;
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);

    const updated = await this.prisma.actionItem.update({
      where: { id: actionId },
      data,
    });

    return {
      success: true,
      id: updated.id,
      status: updated.status,
      reflectionNotes: updated.reflectionNotes,
      dueDate: updated.dueDate,
      message:
        updated.status === 'COMPLETED'
          ? 'Chúc mừng bạn đã biến tri thức trong sách thành hành động thực tế!'
          : 'Đã cập nhật tiến độ hành động thành công.',
    };
  }

  /**
   * Calculate action execution and habit transformation metrics
   */
  async getHabitMetrics(userId: string) {
    const total = await this.prisma.actionItem.count({ where: { userId } });
    const completed = await this.prisma.actionItem.count({
      where: { userId, status: 'COMPLETED' },
    });
    const inProgress = await this.prisma.actionItem.count({
      where: { userId, status: 'IN_PROGRESS' },
    });
    const pending = await this.prisma.actionItem.count({
      where: { userId, status: 'PENDING' },
    });

    const executionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      userId,
      totalTasks: total,
      completed,
      inProgress,
      pending,
      executionRate: `${executionRate}%`,
      habitLevel:
        executionRate >= 80
          ? 'Master Executor (Bậc thầy thực thi)'
          : executionRate >= 50
            ? 'Active Practitioner (Người hành động tích cực)'
            : 'Knowledge Consumer (Đang xây dựng thói quen)',
    };
  }
}

