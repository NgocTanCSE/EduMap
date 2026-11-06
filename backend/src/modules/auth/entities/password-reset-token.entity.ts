import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
@Entity('password_reset_tokens')
export class PasswordResetToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ unique: true })
    token: string;
    @Column()
    expiresAt: Date;
    @Column({ default: false })
    isUsed: boolean;
    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;
    @Column({ name: 'user_id' })
    user_id: string;
    @CreateDateColumn()
    createdAt: Date;
    @UpdateDateColumn()
    updatedAt: Date;
}
