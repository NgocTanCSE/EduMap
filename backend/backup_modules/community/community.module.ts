import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post, Comment, Group } from './entities/community.entity';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Comment, Group])],
  providers: [CommunityService],
  controllers: [CommunityController],
})
export class CommunityModule {}
