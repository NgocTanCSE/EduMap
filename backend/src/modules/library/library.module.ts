import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibraryService } from './library.service';
import { LibraryController } from './library.controller';
import { LearningMaterial } from './entities/learning-material.entity';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([LearningMaterial]), forwardRef(() => AIModule)],
  providers: [LibraryService],
  controllers: [LibraryController],
  exports: [LibraryService],
})
export class LibraryModule {}
