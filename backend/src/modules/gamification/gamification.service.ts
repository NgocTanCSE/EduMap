import { Injectable } from '@nestjs/common';

export interface UserProgress {
  userId: string;
  points: number;
  achievements: string[];
}

@Injectable()
export class GamificationService {
  private userProgress: Record<string, UserProgress> = {}; // In-memory mock data

  constructor() {
    // Initialize with some mock data
    this.userProgress['1'] = { userId: '1', points: 100, achievements: ['First Login', 'Completed Profile'] };
    this.userProgress['2'] = { userId: '2', points: 250, achievements: ['First Login', 'Solved 5 Quizzes', 'Helped a Peer'] };
  }

  async getUserProgress(userId: string): Promise<UserProgress | undefined> {
    // In a real app, this would fetch data from a database
    return this.userProgress[userId];
  }

  async awardPoints(userId: string, points: number): Promise<UserProgress> {
    if (!this.userProgress[userId]) {
      this.userProgress[userId] = { userId, points: 0, achievements: [] };
    }
    this.userProgress[userId].points += points;
    // In a real app, this would update the database
    return this.userProgress[userId];
  }

  async grantAchievement(userId: string, achievement: string): Promise<UserProgress> {
    if (!this.userProgress[userId]) {
      this.userProgress[userId] = { userId, points: 0, achievements: [] };
    }
    if (!this.userProgress[userId].achievements.includes(achievement)) {
      this.userProgress[userId].achievements.push(achievement);
    }
    // In a real app, this would update the database
    return this.userProgress[userId];
  }
}
