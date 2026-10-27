import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { enumColumn, jsonColumn, textArrayColumn } from '../../../common/utils/db-column.utils';

export enum NeedUrgency {
  CRITICAL = 'critical', // Khẩn cấp nhất
  HIGH = 'high',        // Cao
  MEDIUM = 'medium',     // Trung bình
  LOW = 'low',          // Thấp
}

export enum NeedStatus {
  OPEN = 'open',       // Đang tìm kiếm tài trợ
  MATCHED = 'matched',  // Đã ghép nối sponsor
  CLOSED = 'closed',    // Đã đủ nguồn hoặc hủy
}

/**
 * Nhu cầu cần được tài trợ (nguồn lực).
 *
 * Nửi "nhận" trong cặp đôi need ↔ sponsor. Mỗi nhu cầu có danh mục (category),
 * mức độ khẩn cấp (urgency), chi phí ước tính (cost_estimate) và khu vực
 * (location). Hệ thống sẽ tìm sponsor có ngân sách và lĩnh vực phù hợp.
 *
 * Dữ liệu được xác minh từ nguồn chính thức — xem scripts/real_vn_data.py.
 */
@Entity('sponsor_needs')
export class SponsorNeed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string; // Ví dụ: "Xây thư viện STEM THPT Trấn Biên"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 100 })
  category: string; // education_equipment, scholarship, infrastructure, environment, social_welfare

  @Column({ ...enumColumn(), default: NeedUrgency.MEDIUM })
  urgency: NeedUrgency;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  cost_estimate: number;

  @Column({ length: 255, nullable: true })
  location: string; // Tỉnh/thành hoặc khu vực

  @Column({ ...enumColumn(), default: NeedStatus.OPEN })
  status: NeedStatus;

  @Column(textArrayColumn())
  tags: string[];

  @Column({ nullable: true })
  apply_url: string; // URL trang chính thức (provenance)

  @Column({ type: 'text', nullable: true })
  provenance: string; // "Nguồn: <url> · Kiểm chứng: <date>"

  @Column({ nullable: true })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
