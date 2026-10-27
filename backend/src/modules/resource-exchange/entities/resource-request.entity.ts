import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { enumColumn, textArrayColumn } from '../../../common/utils/db-column.utils';
import { ResourceType } from './resource.entity';

/** Mức độ khẩn cấp của một yêu cầu nguồn lực. */
export enum RequestUrgency {
  CRITICAL = 'critical', // Khẩn cấp nhất
  HIGH = 'high', // Cao
  MEDIUM = 'medium', // Trung bình
  LOW = 'low', // Thấp
}

/** Trạng thái của một yêu cầu. */
export enum RequestStatus {
  OPEN = 'open', // Đang tìm kiếm nguồn lực
  FILLED = 'filled', // Đã tìm được nguồn lực phù hợp
  CLOSED = 'closed', // Đã hủy / không cần nữa
}

/**
 * Yêu cầu nguồn lực của người dùng (nơi "nhận" trong cặp đôi cung–cầu).
 *
 * Nửi "nhận" trong cặp đôi resource ↔ request. Mỗi request gắn `need_type`
 * (phải khớp `type` của resource), `urgency`, `deadline`, `location` + lat/lng
 * để hệ thống tính khoảng cách và đưa ra lịch giao nhận.
 */
@Entity('resource_requests')
export class ResourceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ ...enumColumn(), enum: ResourceType })
  need_type: ResourceType;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ ...enumColumn(), enum: RequestUrgency, default: RequestUrgency.MEDIUM })
  urgency: RequestUrgency;

  @Column({ length: 255 })
  location: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng: number;

  /** Thời hạn cần có nguồn lực (ISO). */
  @Column({ type: 'text', nullable: true })
  deadline: string | null;

  /** Điều kiện tối thiểu mong muốn (0–5). */
  @Column({ type: 'int', default: 0 })
  preferred_min_condition: number;

  @Column({ length: 255, nullable: true })
  contact_method: string;

  @Column({ ...enumColumn(), enum: RequestStatus, default: RequestStatus.OPEN })
  status: RequestStatus;

  @Column(textArrayColumn())
  tags: string[];

  @Column({ nullable: true })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
