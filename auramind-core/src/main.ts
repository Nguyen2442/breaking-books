import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('AuraMindBootstrap');
  const app = await NestFactory.create(AppModule);

  // Global Request Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 AuraMind Enterprise Core Backend running on: http://localhost:${port}`);
  logger.log(`⚡ Connected to Gemini AI Engine with Model: ${process.env.GEMINI_MODEL || 'gemini-3.5-flash'}`);
}
bootstrap();
