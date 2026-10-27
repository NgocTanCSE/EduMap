import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { enumColumn, jsonColumn, textArrayColumn } from '../../../common/utils/db-column.utils';

export enum SponsorStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/**
 * Nhà tài trợ / tổ chức có nguồn lực tài trợ.
 *
 * Đây là nửi "cung cấp" trong cặp đôi need ↔ sponsor. Mỗi sponsor có ngân
 * sách tối đa, lĩnh vực tập trung (focus_areas) và khu vực hoạt động
 * (location). Hệ thống sẽ ghép nối các nhu cầu (sponsor_needs) với các
 * sponsor phù hợp dựa trên tiêu chí này.
 *
 * Dữ liệu được xác minh từ nguồn chính thức — xem scripts/real_vn_data.py.
 */
@Entity('sponsor_profiles')
export class SponsorProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string; // Tên tổ chức, ví dụ: "Bộ Giáo dục và Đào tạo"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column(jsonColumn())
  focus_areas: string[]; // Lĩnh vực tài trợ: ["education", "scholarship", "stem", ...]

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  budget_amount: number;

  @Column({ length: 10, default: 'VND' })
  budget_currency: string;

  @Column({ length: 255, nullable: true })
  location: string; // Tỉnh/thành hoặc khu vực

  @Column({ nullable: true })
  website_url: string;

  @Column({ nullable: true })
  contact_email: string;

  @Column({ ...enumColumn(), enum: SponsorStatus, default: SponsorStatus.ACTIVE })
  status: SponsorStatus;

  @Column({ default: false })
  is_verified: boolean;

  @Column({ nullable: true })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
