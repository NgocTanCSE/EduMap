import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { Transaction, TransactionStatus } from '../business/entities/transaction.entity';
import { Order, OrderStatus } from '../business/entities/order.entity';
import { Booking } from '../mentor/entities/mentor.entity';
import { Repository } from 'typeorm';

describe('PaymentService', () => {
  let service: PaymentService;
  let transactionRepo: Repository<Transaction>;
  let orderRepo: Repository<Order>;
  let bookingRepo: Repository<Booking>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
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
    it('should process successful payment', async () => {
      const mockTransaction = {
        id: 'txn-1',
        status: TransactionStatus.PENDING,
        paymentMethod: 'momo',
        orderId: 'order-1',
        amount: 100000,
      };

      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.PENDING,
      };

      jest.spyOn(transactionRepo, 'findOne').mockResolvedValue(mockTransaction as Transaction);
      jest.spyOn(orderRepo, 'findOne').mockResolvedValue(mockOrder as Order);
      jest.spyOn(bookingRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(transactionRepo, 'save').mockResolvedValue({ ...mockTransaction, status: TransactionStatus.SUCCESS } as Transaction);
      jest.spyOn(orderRepo, 'save').mockResolvedValue({ ...mockOrder, status: OrderStatus.PAID } as Order);

      const result = await service.processPayment('txn-1', {});

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should return message when transaction already paid', async () => {
      const mockTransaction = {
        id: 'txn-1',
        status: TransactionStatus.SUCCESS,
        paymentMethod: 'momo',
      };

      jest.spyOn(transactionRepo, 'findOne').mockResolvedValue(mockTransaction as Transaction);

      const result = await service.processPayment('txn-1', {});

      expect(result).toBeDefined();
      expect(result.message).toContain('đã được thanh toán');
    });

    it('should throw BadRequestException when transaction not found', async () => {
      jest.spyOn(transactionRepo, 'findOne').mockResolvedValue(null);

      await expect(service.processPayment('non-existent', {})).rejects.toThrow();
    });
  });

  describe('createBookingTransaction', () => {
    it('should create a new transaction for a booking', async () => {
      const mockBooking = {
        id: 'booking-1',
        student_id: 'user-1',
        payment_status: 'unpaid',
        amount: 200000,
      };

      const mockTransaction = {
        id: 'txn-1',
        paymentMethod: 'momo',
        amount: 200000,
        status: TransactionStatus.PENDING,
      };

      jest.spyOn(bookingRepo, 'findOne').mockResolvedValue(mockBooking as Booking);
      jest.spyOn(transactionRepo, 'create').mockReturnValue(mockTransaction as Transaction);
      jest.spyOn(transactionRepo, 'save').mockResolvedValue(mockTransaction as Transaction);
      jest.spyOn(bookingRepo, 'save').mockResolvedValue(mockBooking as Booking);

      const result = await service.createBookingTransaction('user-1', 'booking-1', 'momo');

      expect(result).toBeDefined();
      expect(result.id).toBe('txn-1');
      expect(transactionRepo.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when booking not found', async () => {
      jest.spyOn(bookingRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.createBookingTransaction('user-1', 'non-existent', 'momo'),
      ).rejects.toThrow();
    });

    it('should return message when booking already paid', async () => {
      const mockBooking = {
        id: 'booking-1',
        student_id: 'user-1',
        payment_status: 'paid',
      };

      jest.spyOn(bookingRepo, 'findOne').mockResolvedValue(mockBooking as Booking);

      const result = await service.createBookingTransaction('user-1', 'booking-1', 'momo');

      expect(result).toBeDefined();
      expect(result.message).toContain('đã được thanh toán');
    });
  });
});
