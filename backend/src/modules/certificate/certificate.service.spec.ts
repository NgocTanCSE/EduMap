import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CertificateService } from './certificate.service';
import { UserCertificate } from './entities/user-certificate.entity';
import { Repository } from 'typeorm';

describe('CertificateService', () => {
  let service: CertificateService;
  let repo: Repository<UserCertificate>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateService,
        {
          provide: getRepositoryToken(UserCertificate),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CertificateService>(CertificateService);
    repo = module.get<Repository<UserCertificate>>(getRepositoryToken(UserCertificate));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPortfolio', () => {
    it('should return array of user certificates', async () => {
      const mockCerts = [
        { id: 'cert-1', title: 'React Workshop', type: 'workshop' },
        { id: 'cert-2', title: 'Volunteer Certificate', type: 'volunteer' },
      ];
      jest.spyOn(repo, 'find').mockResolvedValue(mockCerts as UserCertificate[]);

      const result = await service.getPortfolio('user-1');

      expect(result).toEqual(mockCerts);
      expect(repo.find).toHaveBeenCalled();
    });
  });

  describe('verifyCertificate', () => {
    it('should return certificate when code is valid', async () => {
      const mockCert = { id: 'cert-1', verify_code: 'CERT-ABC123', title: 'Valid Cert' };
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockCert as UserCertificate);

      const result = await service.verifyCertificate('CERT-ABC123');

      expect(result).toEqual(mockCert);
    });

    it('should throw error when code is invalid', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(service.verifyCertificate('INVALID')).rejects.toThrow();
    });
  });

  describe('issueCertificate', () => {
    it('should create new certificate', async () => {
      const mockCert = { id: 'cert-1', title: 'New Cert', verify_code: 'CERT-XYZ789' };
      jest.spyOn(repo, 'create').mockReturnValue(mockCert as UserCertificate);
      jest.spyOn(repo, 'save').mockResolvedValue(mockCert as UserCertificate);

      const result = await service.issueCertificate({
        user_id: 'user-1',
        title: 'New Cert',
        type: 'workshop',
        issued_at: '2026-07-15',
        issuer: 'DNTU',
      });

      expect(result).toEqual(mockCert);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
