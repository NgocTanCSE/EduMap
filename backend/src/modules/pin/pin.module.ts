import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinService } from './pin.service';
import { PinController } from './pin.controller';
import { Pin } from './entities/pin.entity';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pin, User])],
  providers: [PinService],
  controllers: [PinController],
  exports: [PinService],
})
export class PinModule {}
