import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternationalProgram, AlumniNetwork } from './entities/intl.entity';
import { IntlService } from './intl.service';
import { IntlController } from './intl.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InternationalProgram, AlumniNetwork])],
  providers: [IntlService],
  controllers: [IntlController],
  exports: [IntlService],
})
export class IntlModule {}
