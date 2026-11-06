import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCertificate } from './entities/user-certificate.entity';
import { Organization } from './entities/organization.entity';
import { CertificateTemplate } from './entities/certificate-template.entity';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.controller';
import { BlockchainService } from '../blockchain/blockchain.service';
import { BlockchainController } from '../blockchain/blockchain.controller';
@Module({
    imports: [TypeOrmModule.forFeature([UserCertificate, Organization, CertificateTemplate])],
    providers: [CertificateService, BlockchainService],
    controllers: [CertificateController, BlockchainController],
    exports: [CertificateService],
})
export class CertificateModule {
}
