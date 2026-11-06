import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
@Entity('location_categories')
export class LocationCategory {
    @PrimaryGeneratedColumn()
    id: number;
    @Column({ unique: true })
    name: string;
    @Column({ nullable: true })
    display_name: string;
    @Column({ nullable: true })
    marker_color: string;
}
