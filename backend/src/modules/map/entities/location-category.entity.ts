import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('location_categories')
export class LocationCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string; // e.g., school, library, lab, wifi_hotspot

  @Column({ nullable: true })
  display_name: string; // e.g., Trường học, Thư viện

  @Column({ nullable: true })
  icon_name: string; // Lucide icon name

  @Column({ nullable: true })
  marker_color: string; // Hex color for the marker
}
