import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hackathon } from './entities/hackathon.entity';

@Injectable()
export class HackathonService {
  constructor(
    @InjectRepository(Hackathon) private hackRepo: Repository<Hackathon>,
  ) {}

  // 1. N?p bài d? thi (Submission)
  async submitProject(teamId: string, hackathonId: string, repoUrl: string, demoVideo: string) {
    // Lýu thông tin submission
    return { success: true, message: 'N?p bài thành công! Vui l?ng ch? BGK ch?m ði?m.' };
  }

  // 2. Ban giám kh?o ch?m ði?m (Judging System)
  async judgeProject(judgeId: string, submissionId: string, scores: { criteria: string, score: number }[]) {
    // Ch? Role = 'Judge' m?i ðý?c phép g?i hàm này
    const totalScore = scores.reduce((sum, item) => sum + item.score, 0);
    return { success: true, submissionId, total_score: totalScore, status: 'judged' };
  }
}

