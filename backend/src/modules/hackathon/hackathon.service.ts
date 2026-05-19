import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hackathon } from './entities/hackathon.entity';
import { HackathonTeam } from './entities/hackathon-team.entity';

@Injectable()
export class HackathonService {
  constructor(
    @InjectRepository(Hackathon) private readonly hackRepo: Repository<Hackathon>,
    @InjectRepository(HackathonTeam) private readonly teamRepo: Repository<HackathonTeam>,
  ) {}

  /**
   * Lấy danh sách cuộc thi Hackathon
   */
  async getHackathons() {
    return this.hackRepo.find({ order: { start_date: 'DESC' } });
  }

  /**
   * Đăng ký đội thi tham dự Hackathon
   */
  async registerTeam(leaderId: string, data: any) {
    const hackathon = await this.hackRepo.findOne({ where: { id: data.hackathon_id } });
    if (!hackathon) {
      throw new NotFoundException('Không tìm thấy cuộc thi Hackathon');
    }

    if (hackathon.status === 'completed') {
      throw new BadRequestException('Cuộc thi này đã kết thúc, không thể đăng ký thêm.');
    }

    const existingTeam = await this.teamRepo.findOne({
      where: { hackathon_id: data.hackathon_id, leader_id: leaderId },
    });
    if (existingTeam) {
      throw new BadRequestException('Bạn đã đăng ký một đội thi trong cuộc thi này rồi.');
    }

    const team = this.teamRepo.create({
      team_name: data.team_name,
      hackathon_id: data.hackathon_id,
      leader_id: leaderId,
      members: data.members || [],
      status: 'registered',
    });

    return this.teamRepo.save(team);
  }

  /**
   * Nộp bài dự thi (Submission)
   */
  async submitProject(leaderId: string, teamId: string, repoUrl: string, demoVideo: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId, leader_id: leaderId } });
    if (!team) {
      throw new NotFoundException('Không tìm thấy đội thi tương ứng hoặc bạn không phải là Trưởng nhóm');
    }

    team.repo_url = repoUrl;
    team.demo_video = demoVideo;
    team.status = 'submitted';

    await this.teamRepo.save(team);

    return {
      success: true,
      message: 'Nộp bài dự thi thành công! Vui lòng chờ Ban giám khảo chấm điểm.',
      submission: {
        team_name: team.team_name,
        repo_url: team.repo_url,
        demo_video: team.demo_video,
        submitted_at: new Date(),
      },
    };
  }

  /**
   * Ban giám khảo chấm điểm dự án (Judging System)
   */
  async judgeProject(judgeId: string, teamId: string, scores: { criteria: string; score: number }[], feedback?: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('Không tìm thấy đội thi dự thi để chấm điểm');
    }

    if (team.status !== 'submitted') {
      throw new BadRequestException('Đội thi chưa nộp bài, không thể chấm điểm.');
    }

    const totalScore = scores.reduce((sum, item) => sum + Number(item.score), 0);

    team.score = totalScore;
    team.feedback = feedback || 'Chấm điểm bởi Hội đồng Ban Giám Khảo';
    team.status = 'judged';

    await this.teamRepo.save(team);

    return {
      success: true,
      message: 'Chấm điểm dự án thành công!',
      team_name: team.team_name,
      total_score: totalScore,
      feedback: team.feedback,
      status: 'judged',
    };
  }
}
