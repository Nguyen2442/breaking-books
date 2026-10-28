import { Module } from '@nestjs/common';
import { SpacedRepetitionController } from './spaced-repetition.controller';
import { SpacedRepetitionService } from './spaced-repetition.service';
import { RustEngineClient } from '../../common/rust-engine.client';

@Module({
  controllers: [SpacedRepetitionController],
  providers: [SpacedRepetitionService, RustEngineClient],
  exports: [SpacedRepetitionService],
})
export class SpacedRepetitionModule {}

