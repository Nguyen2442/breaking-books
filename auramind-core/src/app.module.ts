import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { GeminiService } from './modules/ai/gemini.service';
import { BooksController } from './modules/books/books.controller';
import { BooksService } from './modules/books/books.service';
import { BookProcessor } from './modules/queue/book-processor';

@Module({
  imports: [
    // Global Config (.env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

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
  ],
  controllers: [BooksController],
  providers: [GeminiService, BooksService, BookProcessor],
})
export class AppModule {}
