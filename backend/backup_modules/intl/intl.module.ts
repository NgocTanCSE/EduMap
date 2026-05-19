import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternationalProgram } from './entities/intl.entity';
import { IntlService } from './intl.service';
import { IntlController } from './intl.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InternationalProgram])],
  providers: [IntlService],
  controllers: [IntlController],
})
export class IntlModule {}
