import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Payment')
@Controller('payment')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('process/:transactionId')
  @ApiOperation({ summary: 'Xử lý thanh toán mô phỏng (Simulate Payment Processing)' })
  async processPayment(
    @Param('transactionId') transactionId: string,
    @Body() paymentData: any
  ) {
    return this.paymentService.processPayment(transactionId, paymentData);
  }

  @Post('booking/:bookingId')
  @ApiOperation({ summary: 'Tạo giao dịch thanh toán cho lịch hẹn Mentor' })
  async createBookingTransaction(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
    @Body('paymentMethod') paymentMethod: string
  ) {
    return this.paymentService.createBookingTransaction(req.user.id, bookingId, paymentMethod || 'BANK_TRANSFER');
  }
}
