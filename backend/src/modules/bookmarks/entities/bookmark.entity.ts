import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** Loại đối tượng người dùng có thế đánh dấu "lưu" */
export enum BookmarkTargetType {
  INTERNSHIPS = 'internships',
  SCHOLARSHIPS = 'scholarships',
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
