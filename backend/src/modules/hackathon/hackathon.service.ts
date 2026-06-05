import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Hackathon } from './entities/hackathon.entity';
import { HackathonTeam } from './entities/hackathon-team.entity';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class HackathonService {
  private readonly logger = new Logger(HackathonService.name);

  constructor(
    @InjectRepository(Hackathon) private readonly hackRepo: Repository<Hackathon>,
    @InjectRepository(HackathonTeam) private readonly teamRepo: Repository<HackathonTeam>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Lấy danh sách cuộc thi Hackathon
   */
  async getHackathons() {
    return this.hackRepo.find({ order: { start_date: 'DESC' } });
  }

  /**
   * Lấy chi tiết cuộc thi Hackathon theo ID
   */
  async getHackathonById(id: string) {
    const hackathon = await this.hackRepo.findOne({ where: { id } });
    if (!hackathon) {
      throw new NotFoundException('Không tìm thấy cuộc thi Hackathon');
    }
    return hackathon;
  }

  /**
   * Đăng ký đội thi tham dự Hackathon (Đã vá lỗi Logic Nghiệp vụ)
   */
  async registerTeam(leaderId: string, data: any) {
    const hackathon = await this.hackRepo.findOne({ where: { id: data.hackathon_id } });
    if (!hackathon) {
      throw new NotFoundException('Không tìm thấy cuộc thi Hackathon');
    }

    if (hackathon.status === 'completed') {
      throw new BadRequestException('Cuộc thi này đã kết thúc, không thể đăng ký thêm.');
    }

    // 1. Validation: Kiểm tra số lượng thành viên (Elite Coder Rule)
    const membersList: string[] = Array.isArray(data.members) ? data.members : [];
    // Một đội tối thiểu 3 người (1 Leader + 2 Member), tối đa 5 người (1 Leader + 4 Member)
    if (membersList.length < 2 || membersList.length > 4) {
      throw new BadRequestException('Số lượng thành viên không hợp lệ. Đội thi phải có từ 3 đến 5 người (bao gồm cả trưởng nhóm). Vui lòng nhập từ 2 đến 4 email thành viên.');
    }

    // 2. Validation: Kiểm tra Email hợp lệ trong hệ thống
    const validUsers = await this.userRepo.find({
        where: { email: In(membersList) },
        select: ['email']
    });
    
    if (validUsers.length !== membersList.length) {
        const validEmails = validUsers.map(u => u.email);
        const invalidEmails = membersList.filter(email => !validEmails.includes(email));
        throw new BadRequestException(`Các email sau không tồn tại trong hệ thống EduMap: ${invalidEmails.join(', ')}`);
    }

    const existingTeam = await this.teamRepo.findOne({
      where: { hackathon_id: data.hackathon_id, leader_id: leaderId },
    });
    if (existingTeam) {
      throw new BadRequestException('Bạn đã là trưởng nhóm của một đội thi trong cuộc thi này rồi.');
    }

    // Defensive: Đảm bảo format chuẩn trước khi lưu
    const team = this.teamRepo.create({
      team_name: data.team_name.trim(),
      hackathon_id: data.hackathon_id,
      leader_id: leaderId,
      members: validUsers.map(u => u.email), // Chỉ lưu các email đã xác thực
      status: 'registered',
    });

    this.logger.log(`[HACKATHON REG] Leader ${leaderId} registered team ${team.team_name}`);
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
