import { Test, TestingModule } from '@nestjs/testing';
import { BusinessService } from './business.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessProfile } from './entities/business.entity';
import { Product } from './entities/product.entity';
import { Service } from './entities/service.entity';
import { Review } from './entities/review.entity';
import { CartItem } from './entities/cart-item.entity';
import { Order } from './entities/order.entity';
import { Transaction } from './entities/transaction.entity';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

describe('BusinessService', () => {
  let service: BusinessService;
  let mockDataSource: Partial<DataSource>;

  const mockRepo = () => ({
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    }),
    create: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        { provide: getRepositoryToken(BusinessProfile), useFactory: mockRepo },
        { provide: getRepositoryToken(Product), useFactory: mockRepo },
        { provide: getRepositoryToken(Service), useFactory: mockRepo },
        { provide: getRepositoryToken(Review), useFactory: mockRepo },
        { provide: getRepositoryToken(CartItem), useFactory: mockRepo },
        { provide: getRepositoryToken(Order), useFactory: mockRepo },
        { provide: getRepositoryToken(Transaction), useFactory: mockRepo },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn().mockReturnValue({
          connect: jest.fn(),
          startTransaction: jest.fn(),
          manager: {
            save: jest.fn(),
            create: jest.fn(),
          },
          commitTransaction: jest.fn(),
          rollbackTransaction: jest.fn(),
          release: jest.fn(),
        }) } },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
    mockDataSource = module.get<DataSource>(DataSource);
  });

  it('checkout should throw BadRequestException when cart is empty', async () => {
    // Mock getCart to return empty array
    jest.spyOn(service as any, 'getCart').mockResolvedValue([]);
    await expect(service.checkout('user-id', { shippingAddress: 'addr', paymentMethod: 'credit_card' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
