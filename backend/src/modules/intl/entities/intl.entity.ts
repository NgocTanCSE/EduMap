import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('international_programs')
export class InternationalProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  type: string; // exchange/workshop/scholarship/seminar

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  host_country: string;

  @Column({ nullable: true })
  organization: string;

  @Column({ type: process.env.DB_TYPE === 'postgres' ? 'timestamp with time zone' : 'datetime', nullable: true })
  application_deadline: Date;

  @Column({
    // Postgres keeps `jsonb` (array of strings) for parity with the Postgres
    // migration; on SQLite the shipped `edumap.db` stores `benefits` as PLAIN
    // (non-JSON) text such as "Sống cùng gia đình bản xứ, học tại trường…".
    // Declaring the column as `json` makes TypeORM call `JSON.parse()` on every
    // hydrate (DateUtils.stringToSimpleJson runs *before* transformers) which
    // throws `SyntaxError: Unexpected token 'S', "Sống cùng …` is not valid JSON`
    // and turns GET /api/intl/programs into a 500. Reading as `text` + a
    // tolerant transformer avoids the parse and still yields string[] for the
    // frontend. This runs on HF Spaces SQLite only (DB_SYNC=false).
    type: process.env.DB_TYPE === 'postgres' ? 'jsonb' : 'text',
    nullable: true,
    transformer: {
      from(value: any): string[] {
        if (value == null || value === '') return [];
        if (Array.isArray(value)) return value;
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        try {
          const parsed = JSON.parse(str);
          return Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
          // Non-JSON plain text (the shipped SQLite data): split on comma into
          // individual benefit items so the UI renders them as badges.
          return str.split(',').map((v: string) => v.trim()).filter(Boolean);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to(value: any): string {
        if (value == null) return value;
        if (typeof value === 'string') return value;
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
  status: string; // studying, graduated, returned

  @CreateDateColumn()
  created_at: Date;
}
