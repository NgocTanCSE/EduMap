import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { enumColumn } from '../../../common/utils/db-column.utils';

/** Trạng thái của một cặp ghép nguồn lực. */
export enum MatchStatus {
  PENDING = 'pending', // Chờ người nhận xác nhận
  ACCEPTED = 'accepted', // Đã chấp nhận — đang lên lịch giao nhận
  REJECTED = 'rejected', // Từ chối
  COMPLETED = 'completed', // Đã giao nhận thành công
}

/**
 * Kết quả ghép nối một resource (cung) với một request (cầu).
 *
 * Được tạo bởi `ResourceMatchService.matchResources()`:
 *   1. SQLite pre-filter (type match, condition >= min, status available/open)
 *   2. Scoring (proximity + need_level + condition + availability)
 *   3. AI ranking + LLM explanation (POST /api/ai/resource-exchange/match-rank)
 *   4. Greedy scheduling (transport plan)
 *
 * `scheduled_pickup` là kết quả của bước 4 — lịch giao nhận được gán bởi
 * constraint-based greedy scheduler.
 */
@Entity('resource_matches')
export class ResourceMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  resource_id: string;

  @Column({ type: 'uuid' })
  request_id: string;

  /** Điểm số ghép nối (0–100). 100 = hoàn hảo. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  match_score: number;

  /** Giải thích từ LLM (tại sao cặp này phù hợp). */
  @Column({ type: 'text', nullable: true })
  explanation: string;

  @Column({ ...enumColumn(), enum: MatchStatus, default: MatchStatus.PENDING })
  status: MatchStatus;

  /** Lịch giao nhận được đề xuất bởi greedy scheduler (ISO string). */
  @Column({ type: 'text', nullable: true })
  scheduled_pickup: string | null;

  /** Payload lịch trình giao nhận (array JSON). */
  @Column({ type: 'text', nullable: true })
  transport_plan: string | null;

  @Column({ nullable: true })
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
