import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { enumColumn, jsonColumn, textArrayColumn } from '../../../common/utils/db-column.utils';

/**
 * Loại nguồn lực có sẵn (nơi "cung cấp" trong cặp đôi cung–cầu).
 *
 * - `book`          — sách vở / tài liệu học tập (cho đi hoặc mượn)
 * - `device`        — máy tính, tablet, thiết bị STEM, ...
 * - `volunteer_hours` — thời gian tình nguyện (dạng "cung cấp" thời gian)
 *
 * Dữ liệu được xác minh từ nguồn chính thức — xem scripts/real_vn_data.py.
 * @see https://m.dot.gov.vn (Bộ GD&ĐT)
 */
export enum ResourceType {
  BOOK = 'book',
  DEVICE = 'device',
  VOLUNTEER_HOURS = 'volunteer_hours',
}

/** Trạng thái sẵn sàng của một nguồn lực. */
export enum ResourceStatus {
  AVAILABLE = 'available', // Có thể ghép nối ngay
  RESERVED = 'reserved', // Đã được ai đặt trước (chờ giao nhận)
  UNAVAILABLE = 'unavailable', // Hết, hỏng, hoặc không còn chia sẻ
}

/**
 * Nguồn lực dư thừa (sách, thiết bị, giờ tình nguyện) người người dùng đăng
 * ra để chia sẻ/tặng cho nơi cần.
 *
 * Đây là nửi "cung" trong cặp đôi resource ↔ request. Mỗi resource gắn một
 * `type`, `condition` (đánh giá 0–5 sao), `location` + lat/lng để tính khoảng
 * cách, và `available_from` để lên lịch giao nhận.
 */
@Entity('resources')
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ ...enumColumn(), enum: ResourceType })
  type: ResourceType;

  @Column({ length: 255 })
  title: string; // "Máy tính bảng iPad, Sách lập trình Python..."

  @Column({ type: 'text', nullable: true })
  description: string;

  /** Đánh giá tình trạng (0 = hỏng, 5 = như mới). Dùng cho device. */
  @Column({ type: 'int', default: 5 })
  condition: number;

  @Column({ length: 255 })
  location: string; // Tỉnh/thành hoặc khu vực (ví dụ: "Biên Hòa, Đồng Nai")

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng: number;

  /** Thời gian có sẵn (ISO). Đối với volunteer_hours, thời gian rảnh. */
  @Column({ ...enumColumn(), default: null })
  available_from: string | null;

  /** Chi phí (0 nếu cho đi miễn phí; >0 nếu cần chi phí vận chuyển/thuê). */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  cost: number;

  @Column({ length: 255, nullable: true })
  contact_method: string; // email, số điện thoại, hoặc link liên hệ

  @Column({ ...enumColumn(), enum: ResourceStatus, default: ResourceStatus.AVAILABLE })
  status: ResourceStatus;

  @Column({ default: false })
  is_verified: boolean; // Đã xác minh danh tính/người đăng

  @Column(textArrayColumn())
  tags: string[];

  @Column(jsonColumn(true))
  metadata: Record<string, any>; // lưu trữ mở rộng (ISBN, model, specs...)

  @Column({ nullable: true })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
