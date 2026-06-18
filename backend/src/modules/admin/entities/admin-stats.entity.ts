import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('admin_stats')
export class AdminStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'total_users', default: 0 })
  totalUsers: number;

  @Column({ name: 'active_users', default: 0 })
  activeUsers: number;

  @Column({ name: 'total_map_points', default: 0 })
  totalMapPoints: number;

  @Column({ name: 'total_learning_materials', default: 0 })
  totalLearningMaterials: number;

  @Column({ name: 'total_events', default: 0 })
  totalEvents: number;

  @Column({ name: 'total_posts', default: 0 })
  totalPosts: number;

  @Column({ name: 'total_donations', default: 0 })
  totalDonations: number;

  @Column({ name: 'total_certificates', default: 0 })
  totalCertificates: number;

  @Column({ name: 'pending_approvals', default: 0 })
  pendingApprovals: number;

  @Column({ name: 'new_users_today', default: 0 })
  newUsersToday: number;

  @Column({ name: 'new_users_this_week', default: 0 })
  newUsersThisWeek: number;

  @Column({ name: 'new_users_this_month', default: 0 })
  newUsersThisMonth: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
