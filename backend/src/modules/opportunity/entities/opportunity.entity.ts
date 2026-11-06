import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm';
import { geoPointColumn, jsonColumn, datetimeColumn } from '../../../common/utils/db-column.utils';
@Entity('opportunities')
@Index(['category', 'status'])
@Index(['deadline'])
@Index(['region', 'status'])
@Index(['field_tags'], { where: "status = 'active'" })
export class Opportunity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column()
    title: string;
    @Column({ name: 'type', nullable: true })
    category: string;
    @Column({ type: 'text', nullable: true })
    description: string;
    @Column({ nullable: true })
    organization: string;
    @Column({ name: 'location_point', ...geoPointColumn(), nullable: true })
    location: any;
    @Column({ nullable: true })
    address: string;
    @Column({ ...datetimeColumn(true, true) })
    deadline: Date;
    @Column({ type: 'text', nullable: true })
    requirements: string;
    @Column({ type: 'text', nullable: true })
    benefits: string;
    @Column({ nullable: true })
    url: string;
    @Column({ name: 'field_tags', ...jsonColumn(true) })
    field_tags: string[];
    @Column({ nullable: true })
    region: string;
    @Column({ default: 'open' })
    status: string;
    @Column({ name: 'created_by', nullable: true })
    created_by: string;
    @Column({ default: false })
    is_team_finding_open: boolean;
    @Column({ ...jsonColumn(true) })
    tags: string[];
    @CreateDateColumn()
    created_at: Date;
    @UpdateDateColumn()
    updated_at: Date;
    @DeleteDateColumn({ name: 'deleted_at' })
    deleted_at: Date;
}
