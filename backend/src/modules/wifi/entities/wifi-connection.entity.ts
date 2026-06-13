// WiFiConnection entity logging user connections to WiFi locations
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { WifiLocation } from './wifi.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('wifi_connections')
export class WifiConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WifiLocation)
  @JoinColumn({ name: 'wifi_id' })
  wifi: WifiLocation;

  @Column()
  wifi_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @CreateDateColumn()
  connected_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  disconnected_at: Date | null;
}
