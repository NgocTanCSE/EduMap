import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourceMatchService } from './resource-exchange.service';
import { ResourceExchangeController } from './resource-exchange.controller';
import { Resource } from './entities/resource.entity';
import { ResourceRequest } from './entities/resource-request.entity';
import { ResourceMatch } from './entities/resource-match.entity';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([Resource, ResourceRequest, ResourceMatch]), AIModule],
  providers: [ResourceMatchService],
  controllers: [ResourceExchangeController],
  exports: [ResourceMatchService],
})
export class ResourceExchangeModule {}
