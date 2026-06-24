import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GreenChallenge } from './entities/green.entity';

export interface GreenImpact {
  id: string;
  initiative: string;
  carbonSavedKg: number;
  date: string;
}

@Injectable()
export class GreenService {
  private readonly logger = new Logger(GreenService.name);

  constructor(
    @InjectRepository(GreenChallenge)
    private readonly challengeRepo: Repository<GreenChallenge>,
  ) {}

  async getAllImpacts(): Promise<GreenImpact[]> {
    try {
      const challenges = await this.challengeRepo.find({
        select: ['id', 'title', 'points_reward', 'created_at'],
        order: { created_at: 'DESC' },
      });
      return challenges.map(c => ({
        id: c.id,
        initiative: c.title,
        carbonSavedKg: c.points_reward * 0.5,
        date: c.created_at.toISOString().split('T')[0],
      }));
    } catch (error) {
      this.logger.error(`Error fetching green impacts: ${error.message}`);
      return [];
    }
  }

  async getAllChallenges() {
    try {
      const challenges = await this.challengeRepo.find({
        select: ['id', 'title', 'description', 'points_reward', 'status', 'created_at'],
        where: { status: 'active' },
        order: { created_at: 'DESC' },
      });
      
      return challenges.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        points: c.points_reward,
        carbon_saved_kg: c.points_reward * 0.5,
        participants_count: 0,
        image_url: null,
        status: c.status,
      }));
    } catch (error) {
      this.logger.error(`Error fetching green challenges: ${error.message}`);
      return [];
    }
  }

  async addImpact(initiative: string, carbonSavedKg: number): Promise<GreenImpact> {
    try {
      const challenge = this.challengeRepo.create({
        title: initiative,
        points_reward: Math.round(carbonSavedKg * 2),
        status: 'active',
      });
      const saved = await this.challengeRepo.save(challenge);
      return {
        id: saved.id,
        initiative: saved.title,
        carbonSavedKg: saved.points_reward * 0.5,
        date: saved.created_at.toISOString().split('T')[0],
      };
    } catch (error) {
      this.logger.error(`Error adding green impact: ${error.message}`);
      throw error;
    }
  }
}
