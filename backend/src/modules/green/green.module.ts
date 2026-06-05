import { Module } from '@nestjs/common';
import { GreenService } from './green.service';
import { GreenController } from './green.controller';

@Module({
  providers: [GreenService],
  controllers: [GreenController],
  exports: [GreenService],
})
export class GreenModule {}
