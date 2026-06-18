import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Transaction } from '../business/entities/transaction.entity';
import { Order } from '../business/entities/order.entity';
import { Booking } from '../mentor/entities/mentor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Order, Booking]),
  ],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
