import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCertificate } from './entities/user-certificate.entity';
import { Organization } from './entities/organization.entity';
import { CertificateTemplate } from './entities/certificate-template.entity';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserCertificate, Organization, CertificateTemplate])],
  providers: [CertificateService],
  controllers: [CertificateController],
  exports: [CertificateService],
})
export class CertificateModule {}
