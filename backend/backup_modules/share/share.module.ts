import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedItem } from './entities/share.entity';
import { ShareService } from './share.service';
import { ShareController } from './share.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SharedItem])],
  providers: [ShareService],
  controllers: [ShareController],
})
export class ShareModule {}
