import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessProfile } from './entities/business.entity';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { Product } from './entities/product.entity';
import { Service } from './entities/service.entity';
import { Review } from './entities/review.entity';
import { CartItem } from './entities/cart-item.entity'; // Import CartItem
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Transaction } from './entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessProfile,
      Product,
      Service,
      Review,
      CartItem,
      Order,
      OrderItem,
      Transaction,
    ]),
  ],
  providers: [BusinessService],
  controllers: [BusinessController],
  exports: [BusinessService],
})
export class BusinessModule {}
