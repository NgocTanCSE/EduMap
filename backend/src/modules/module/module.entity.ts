// backend/src/modules/module/module.entity.ts
import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { Feature } from '../feature/feature.entity';

@Entity('modules')
export class Module {
  @PrimaryColumn({ length: 50 })
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => Feature, feature => feature.module)
  features: Feature[];
}
