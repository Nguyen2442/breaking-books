import { Module } from '@nestjs/common';
import { ActionEngineController } from './action-engine.controller';
import { ActionEngineService } from './action-engine.service';

@Module({
  controllers: [ActionEngineController],
  providers: [ActionEngineService],
  exports: [ActionEngineService],
})
export class ActionEngineModule {}

