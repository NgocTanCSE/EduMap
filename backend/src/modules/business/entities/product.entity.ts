import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BusinessProfile } from './business.entity';
import { Review } from './review.entity'; // Import Review entity

@Entity('products')
export class Product {
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

  @Column({ default: 0 })
  stock: number;

  @Column({ nullable: true })
  image_url: string;

  @Column({ name: 'business_profile_id' })
  businessProfileId: string;

  @ManyToOne(() => BusinessProfile, (businessProfile) => businessProfile.products)
  @JoinColumn({ name: 'business_profile_id' })
  businessProfile: BusinessProfile;

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
