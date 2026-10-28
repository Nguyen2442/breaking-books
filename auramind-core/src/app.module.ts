import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { GeminiService } from './modules/ai/gemini.service';
import { BooksController } from './modules/books/books.controller';
import { BooksService } from './modules/books/books.service';
import { BookProcessor } from './modules/queue/book-processor';
import { RagModule } from './modules/rag/rag.module';
import { SpacedRepetitionModule } from './modules/spaced-repetition/spaced-repetition.module';
import { ActionEngineModule } from './modules/action-engine/action-engine.module';
import { RustEngineClient } from './common/rust-engine.client';

@Module({
  imports: [
    // Global Config (.env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Global Database Singleton
    PrismaModule,

    // Redis BullMQ Configuration
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD', undefined),
        },
      }),
    }),

    // Register Background Processing Queue
    BullModule.registerQueue({
      name: 'book-processing-queue',
    }),

    // Proprietary Moats
    RagModule,
    SpacedRepetitionModule,
    ActionEngineModule,
  ],
  controllers: [BooksController],
  providers: [GeminiService, BooksService, BookProcessor, RustEngineClient],
})
export class AppModule {}
