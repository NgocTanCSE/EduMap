import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

/** Loại đăng pin lên bản đồ (đáp ứng: sự kiện, quảng cáo, không gian xanh, sách, wifi...). */
export enum PinType {
  EVENT = 'event',
  AD = 'ad',
  GREEN = 'green',
  BOOK = 'book',
  WIFI = 'wifi',
  NOTE = 'note',
  OTHER = 'other',
}

/** Trạng thái duyệt — mặc định pending để admin kiểm duyệt trước khi hiển thị trên bản đồ. */
export enum PinStatus {
  PENDING = 'pending',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
}

/**
 * Pin (ghim): một đăng tin của người dùng gán lên bản đồ tại một vị trí.
 * - `location` dùng geometry(Geometry,4326) để hỗ trợ vừa Point (chỗ nào có sự kiện)
 *   vừa LineString (ví dụ "cạo quảng cáo trên cột điện từ khu này đến khu kia").
 * - `posted_by` / `poster_name` gán theo tên người post ghim.
 */
@Entity('pins')
@Index(['status', 'type'])
@Index(['posted_by'])
@Index(['location'], { spatial: true })
export class Pin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'varchar', length: 50, default: PinType.EVENT })
  type: string;

  @Column({ name: 'poster_name', type: 'varchar', length: 255, nullable: true })
  poster_name: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'posted_by' })
  poster: User;

  @Column({ name: 'posted_by', type: 'uuid', nullable: true })
  posted_by: string;

  // GeoJSON Geometry: { type: 'Point' | 'LineString', coordinates: [...] }
  @Column({
    type: process.env.DB_TYPE === 'postgres' ? 'geometry' : 'json',
    ...(process.env.DB_TYPE === 'postgres'
      ? { spatialFeatureType: 'Geometry', srid: 4326 }
      : {}),
  })
  location: any;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true })
  province: string;

  @Column({ type: 'varchar', length: 100, default: PinStatus.PENDING })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  photos: string[];

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;
}
