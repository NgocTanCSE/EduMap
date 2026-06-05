// backend/src/modules/feature/feature.entity.ts
import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Module } from '../module/module.entity';

@Entity('features')
export class Feature {
  @PrimaryColumn({ length: 50 })
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50, name: 'module_id' }) // Explicitly name the column
  moduleId: string; // Property for the foreign key value

  @ManyToOne(() => Module, module => module.features)
  @JoinColumn({ name: 'module_id' }) // Specify the foreign key column
  module: Module; // Relationship property
}
