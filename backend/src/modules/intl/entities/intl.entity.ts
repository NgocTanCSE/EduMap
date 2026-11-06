import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
@Entity('international_programs')
export class InternationalProgram {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column()
    title: string;
    @Column()
    type: string;
    @Column({ type: 'text', nullable: true })
    description: string;
    @Column({ nullable: true })
    host_country: string;
    @Column({ nullable: true })
    organization: string;
    @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime', nullable: true })
    application_deadline: Date;
    @Column({
        type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'text',
        nullable: true,
        transformer: {
            from(value: any): string[] {
                if (value == null || value === '')
                    return [];
                if (Array.isArray(value))
                    return value;
                const str = typeof value === 'string' ? value : JSON.stringify(value);
                try {
                    const parsed = JSON.parse(str);
                    return Array.isArray(parsed) ? parsed : [String(parsed)];
                }
                catch {
                    return str.split(',').map((v: string) => v.trim()).filter(Boolean);
                }
            },
            to(value: any): string {
                if (value == null)
                    return value;
                if (typeof value === 'string')
                    return value;
                return JSON.stringify(value);
            },
        },
    })
    benefits: string[];
    @Column({ nullable: true })
    apply_url: string;
    @CreateDateColumn()
    created_at: Date;
}
@Entity('alumni_networks')
export class AlumniNetwork {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column()
    full_name: string;
    @Column()
    university: string;
    @Column()
    country: string;
    @Column()
    major: string;
    @Column({ type: process.env.DB_TYPE === 'postgres' ? 'geography' : 'json', ...(process.env.DB_TYPE === 'postgres' ? { ...(process.env.DB_TYPE === 'postgres' ? { spatialFeatureType: 'Point' } : {}), srid: 4326 } : {}) })
    location: any;
    @Column({ nullable: true })
    contact_email: string;
    @Column({ default: 'studying' })
    status: string;
    @CreateDateColumn()
    created_at: Date;
}
