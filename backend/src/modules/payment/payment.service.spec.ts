import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction, TransactionStatus } from '../business/entities/transaction.entity';
import { Order, OrderStatus } from '../business/entities/order.entity';
import { Booking } from '../mentor/entities/mentor.entity';
import { Repository } from 'typeorm';

describe('PaymentService', () => {
  let service: PaymentService;
  let transactionRepo: Repository<Transaction>;
  let orderRepo: Repository<Order>;
  let bookingRepo: Repository<Booking>;

  const mockTransactionRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockOrderRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockBookingRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepo,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepo,
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: mockBookingRepo,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    transactionRepo = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    orderRepo = module.get<Repository<Order>>(getRepositoryToken(Order));
    bookingRepo = module.get<Repository<Booking>>(getRepositoryToken(Booking));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processPayment', () => {
    it('should throw error if transaction not found', async () => {
      jest.spyOn(transactionRepo, 'findOne').mockResolvedValue(null);

      await expect(service.processPayment('nonexistent-id', {})).rejects.toThrow('Giao dịch không tồn tại');
    });

    it('should return message if already paid', async () => {
      const mockTransaction = {
        id: 'tx-1',
        status: TransactionStatus.SUCCESS,
      };
      jest.spyOn(transactionRepo, 'findOne').mockResolvedValue(mockTransaction as any);

      const result = await service.processPayment('tx-1', {});

      expect(result).toHaveProperty('message');
    });
  });

  describe('createBookingTransaction', () => {
    it('should throw error if booking not found', async () => {
      jest.spyOn(bookingRepo, 'findOne').mockResolvedValue(null);

      await expect(service.createBookingTransaction('user-1', 'booking-1', 'vnpay')).rejects.toThrow('Lịch hẹn không tồn tại');
    });
  });
});