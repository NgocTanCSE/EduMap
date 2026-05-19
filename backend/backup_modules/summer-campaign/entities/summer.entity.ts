import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
@Entity('summer_campaigns')
export class SummerCampaign {
  @PrimaryGeneratedColumn() id: number;
  @Column() year: number;
  @Column() location: string;
  @Column() status: string;
}
