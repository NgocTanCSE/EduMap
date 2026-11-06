import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from './organization.entity';
@Entity('certificate_templates')
export class CertificateTemplate {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @ManyToOne(() => Organization)
    @JoinColumn({ name: 'organization_id' })
    organization: Organization;
    @Column()
    organization_id: string;
    @Column()
    name: string;
    @Column({ type: 'text', nullable: true })
    description: string;
    @Column()
    type: string;
    @CreateDateColumn()
    created_at: Date;
    @UpdateDateColumn()
    updated_at: Date;
}
