import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';

@Module({
  imports: [
    HttpModule,
    CacheModule.register(), // S? d?ng global cache n?u ? c?u hnh ? AppModule
  ],
  providers: [AIService],
  controllers: [AIController],
  exports: [AIService],
})
export class AIModule {}
