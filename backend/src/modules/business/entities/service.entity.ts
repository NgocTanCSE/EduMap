import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BusinessProfile } from './business.entity';
import { Review } from './review.entity';

@Entity('business_services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ default: 'VND' })
  currency: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  duration: string; // e.g., "1 hour", "per month"

  @Column({ nullable: true })
  location: string; // e.g., "Online", "Hanoi"

  @Column({ name: 'business_profile_id' })
  businessProfileId: string;

  @ManyToOne(() => BusinessProfile, (businessProfile) => businessProfile.services)
  @JoinColumn({ name: 'business_profile_id' })
  businessProfile: BusinessProfile;

  @OneToMany(() => Review, (review) => review.service)
  reviews: Review[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
