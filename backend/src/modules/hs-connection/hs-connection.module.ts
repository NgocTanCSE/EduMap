import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UniversityCounseling } from './entities/hs.entity';
import { StudentConnection } from './entities/student-connection.entity';
import { HsQuestion, HsAnswer } from './entities/hs-qa.entity';
import { User } from '../auth/entities/user.entity';
import { HsConnectionService } from './hs-connection.service';
import { HsConnectionController } from './hs-connection.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UniversityCounseling, 
      StudentConnection, 
      HsQuestion, 
      HsAnswer, 
      User
    ])
  ],
  controllers: [HsConnectionController],
  providers: [HsConnectionService],
  exports: [HsConnectionService],
})
export class HsConnectionModule {}
