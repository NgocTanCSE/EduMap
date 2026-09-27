import { DonateController } from './donate.controller';

describe('DonateController (STT 26)', () => {
  let controller: DonateController;
  let vnpayService: any;

  beforeEach(() => {
    vnpayService = { createPaymentUrl: jest.fn() };
    controller = new DonateController({} as any, vnpayService);
  });

  describe('createPaymentUrl()', () => {
    it('gọi VNPayService và trả về paymentUrl', async () => {
      vnpayService.createPaymentUrl.mockReturnValue('https://sandbox.vnpayment.vn/pay?token=abc');

      const req: any = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
        user: { id: 'u1' },
      };

      const result = await controller.createPaymentUrl(req, {
        amount: 100000,
        bankCode: 'NCB',
        orderInfo: 'Quyên góp test',
        orderType: 'donation',
      });

      expect(vnpayService.createPaymentUrl).toHaveBeenCalledTimes(1);
      const [ip, amount, bankCode, orderInfo, orderType] = vnpayService.createPaymentUrl.mock.calls[0];
      expect(amount).toBe(100000);
      expect(bankCode).toBe('NCB');
      expect(orderInfo).toBe('Quyên góp test');
      expect(orderType).toBe('donation');
      expect(result).toEqual({ success: true, data: { paymentUrl: 'https://sandbox.vnpayment.vn/pay?token=abc' } });
    });

    it('dùng giá trị mặc định khi không truyền bankCode/orderInfo/orderType', async () => {
      vnpayService.createPaymentUrl.mockReturnValue('https://vnpay/pay');
      const req: any = {
        headers: { 'x-forwarded-for': '203.0.113.5' },
        socket: { remoteAddress: '127.0.0.1' },
        user: { id: 'u1' },
      };

      await controller.createPaymentUrl(req, { amount: 50000 });

      const [ip, amount, bankCode, orderInfo, orderType] = vnpayService.createPaymentUrl.mock.calls[0];
      expect(ip).toBe('203.0.113.5');
      expect(amount).toBe(50000);
      expect(bankCode).toBe('');
      expect(orderInfo).toBe('Donation_u1');
      expect(orderType).toBe('donation');
    });
  });
});
