import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { GeminiService } from '../ai/gemini.service';
import { RustEngineClient } from '../../common/rust-engine.client';

@Module({
  controllers: [RagController],
  providers: [RagService, GeminiService, RustEngineClient],
  exports: [RagService],
})
export class RagModule {}

