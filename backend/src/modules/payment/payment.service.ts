import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus } from '../business/entities/transaction.entity';
import { Order, OrderStatus } from '../business/entities/order.entity';
import { Booking } from '../mentor/entities/mentor.entity';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Transaction) private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
  ) {}

  async processPayment(transactionId: string, paymentData: any) {
    const transaction = await this.transactionRepo.findOne({
      where: { id: transactionId },
      relations: ['order'],
    });

    if (!transaction) throw new BadRequestException('Giao dịch không tồn tại.');
    if (transaction.status === TransactionStatus.SUCCESS) {
      return { message: 'Giao dịch này đã được thanh toán thành công.', transaction };
    }

    this.logger.log(`Processing payment for transaction ${transactionId} via ${transaction.paymentMethod}`);

    // Simulate Payment Gateway call (Momo/VNPay/Stripe)
    const isSuccess = Math.random() > 0.1; // 90% success rate

    if (isSuccess) {
      transaction.status = TransactionStatus.SUCCESS;
      transaction.updated_at = new Date();
      await this.transactionRepo.save(transaction);

       if (transaction.orderId) {
         const order = await this.orderRepo.findOne({ where: { id: transaction.orderId } });
         if (order) {
           order.status = OrderStatus.PAID;
           await this.orderRepo.save(order);
         }
       }

      // Check if this transaction is linked to a booking (using metadata or separate relation if needed)
      // For now, let's assume we can find a booking by transaction_id
      const booking = await this.bookingRepo.findOne({ where: { transaction_id: transactionId } });
      if (booking) {
        booking.payment_status = 'paid';
        await this.bookingRepo.save(booking);
      }

      return { success: true, message: 'Thanh toán thành công.', transaction };
    } else {
      transaction.status = TransactionStatus.FAILED;
      await this.transactionRepo.save(transaction);
      throw new BadRequestException('Thanh toán thất bại. Vui lòng thử lại.');
    }
  }

  async createBookingTransaction(userId: string, bookingId: string, paymentMethod: string) {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId, student_id: userId } });
    if (!booking) throw new BadRequestException('Lịch hẹn không tồn tại.');
    if (booking.payment_status === 'paid') return { message: 'Lịch hẹn đã được thanh toán.' };

    const transaction = this.transactionRepo.create({
      paymentMethod: paymentMethod as any,
      amount: booking.amount,
      status: TransactionStatus.PENDING,
    });

    const savedTransaction = await this.transactionRepo.save(transaction);
    booking.transaction_id = savedTransaction.id;
    await this.bookingRepo.save(booking);

    return savedTransaction;
  }
}
