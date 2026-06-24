import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainService } from './blockchain.service';

describe('BlockchainService', () => {
  let service: BlockchainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockchainService],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signCertificate', () => {
    it('should sign a certificate and return blockchain info', async () => {
      const result = await service.signCertificate('user-1', 'CERT-001', 'Default Template');

      expect(result).toBeDefined();
      expect(result.network).toBe('Polygon PoS (EduMap Layer 2)');
      expect(result.tx_hash).toMatch(/^0x[0-9a-f]+$/);
      expect(result.status).toBe('CONFIRMED');
      expect(result.contract_address).toBeDefined();
      expect(result.explorer_url).toContain('polygonscan.com');
    });
  });

  describe('verifyHash', () => {
    it('should verify a valid tx hash', async () => {
      const validHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

      const result = await service.verifyHash(validHash);

      expect(result.is_valid).toBe(true);
      expect(result.network).toBe('Polygon PoS (EduMap Layer 2)');
    });

    it('should reject an invalid tx hash', async () => {
      const invalidHash = 'invalid-hash';

      const result = await service.verifyHash(invalidHash);

      expect(result.is_valid).toBe(false);
    });
  });
});
