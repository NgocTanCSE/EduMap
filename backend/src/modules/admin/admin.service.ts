import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async getStats() {
    const userCount = await this.userRepo.count();
    return {
      users: userCount,
      activeChallenges: 0,
      totalDonations: 0,
    };
  }
}
