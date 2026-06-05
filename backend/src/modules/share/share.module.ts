import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedItem } from './entities/share.entity';
import { BorrowRequest } from './entities/borrow-request.entity';
import { ShareService } from './share.service';
import { SanitizeService } from './sanitize.service';
import { ShareController } from './share.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SharedItem, BorrowRequest])],
  providers: [ShareService, SanitizeService],
  controllers: [ShareController],
  exports: [ShareService, SanitizeService],
})
export class ShareModule {}
