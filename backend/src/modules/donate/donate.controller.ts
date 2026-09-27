import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DonateService } from './donate.service';
import { VNPayService } from './vnpay.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MOD-DONATE: Quyên góp & Hỗ trợ')
@Controller('donations')
export class DonateController {
  constructor(
    private readonly donateService: DonateService,
    private readonly vnpayService: VNPayService,
  ) {}

  @Get('campaigns')
  @ApiOperation({ summary: 'Lấy danh sách các chiến dịch quyên góp' })
  async getCampaigns() {
    return this.donateService.getAllCampaigns();
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Lấy chi tiết chiến dịch quyên góp theo ID' })
  async getCampaignById(@Param('id') id: string) {
    return this.donateService.getCampaignById(id);
  }

  @Get('campaigns/:id/donors')
  @ApiOperation({ summary: 'Lấy danh sách người đóng góp của một chiến dịch' })
  async getDonors(@Param('id') id: string) {
    return this.donateService.getDonorsByCampaignId(id);
  }

  @Post('campaigns')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo chiến dịch quyên góp mới' })
  async createCampaign(@Body() data: any) {
    return this.donateService.createCampaign(data);
  }

  @Post('payment-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo URL thanh toán VNPay (F-20)' })
  async createPaymentUrl(
    @Request() req: any,
    @Body() body: { amount: number; bankCode?: string; orderInfo?: string; orderType?: string },
  ) {
    const ipAddr =
      (req.headers && (req.headers['x-forwarded-for'] as string)) ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    const paymentUrl = this.vnpayService.createPaymentUrl(
      ipAddr,
      Number(body.amount),
      body.bankCode || '',
      body.orderInfo || `Donation_${req.user.id}`,
      body.orderType || 'donation',
    );
    return { success: true, data: { paymentUrl } };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'F-20: Quyên góp trực tuyến hỗ trợ cộng đồng' })
  async createDonation(@Request() req: any, @Body() body: any) {
    // donor can donate anonymously if selected or logged in user
    const userId = body.is_anonymous ? null : req.user.id;
    return this.donateService.processDonation(body.campaign_id, userId, body.amount, body.transaction_id);
  }
}
