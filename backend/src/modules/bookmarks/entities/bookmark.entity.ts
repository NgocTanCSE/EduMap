import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** Loại đối tượng người dùng có thế đánh dấu "lưu" */
export enum BookmarkTargetType {
  POI = 'poi',
  INTERNSHIPS = 'internships',
  SCHOLARSHIPS = 'scholarships',
  JOB = 'job',
  EVENT = 'event',
  OPPORTUNITY = 'opportunity',
  LAB = 'lab',
  COMMUNITY_POST = 'community_post',
  MARKETPLACE_PRODUCT = 'marketplace_product',
  MARKETPLACE_SERVICE = 'marketplace_service',
  SHARED_ITEM = 'shared_item',
  LIBRARY_ITEM = 'library_item',
  MENTOR = 'mentor',
  DONATE_CAMPAIGN = 'donate_campaign',
  GREEN = 'green',
  WIFI = 'wifi',
  SUMMER = 'summer',
  HACKATHON = 'hackathon',
}

/**
 * Bookmark account-linked: mỗi hàng gắn với một user (`user_id`) và một
 * đối tượng cụ thể (`target_type` + `target_id`). Dùng composite UNIQUE để
 * toggle on/off mà không tạo trùng lặp.
 */
@Entity('bookmarks')
export class Bookmark {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'target_type', type: 'varchar', length: 50 })
  targetType: string;

  @Column({ name: 'target_id', type: 'varchar', length: 255 })
  targetId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
