import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { UniversityCounseling } from './entities/hs.entity';
import { StudentConnection } from './entities/student-connection.entity';
import { HsQuestion, HsAnswer } from './entities/hs-qa.entity';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class HsConnectionService {
  constructor(
    @InjectRepository(UniversityCounseling) private readonly hsRepo: Repository<UniversityCounseling>,
    @InjectRepository(StudentConnection) private readonly connectionRepo: Repository<StudentConnection>,
    @InjectRepository(HsQuestion) private readonly questionRepo: Repository<HsQuestion>,
    @InjectRepository(HsAnswer) private readonly answerRepo: Repository<HsAnswer>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async createCounselingInfo(data: any) {
    const counseling = this.hsRepo.create(data);
    return this.hsRepo.save(counseling);
  }

  async getCounselingList() {
    return this.hsRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  async registerCampusTour(studentId: string, universityName: string) {
    const tourId = `TOUR-${Math.floor(100 + Math.random() * 900)}`;
    return {
      success: true,
      message: `Đăng ký tham quan Virtual Campus Tour thành công.`,
      tour_id: tourId,
      university: universityName,
      scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      student_id: studentId,
    };
  }

  /**
   * --- QA FORUM ---
   */

  async createQuestion(studentId: string, data: { title: string; content: string; university_target?: string }) {
    const question = this.questionRepo.create({
      student_id: studentId,
      ...data
    });
    return this.questionRepo.save(question);
  }

  async getQuestions(university?: string) {
    const where: any = {};
    if (university) where.university_target = university;
    
    return this.questionRepo.find({
      where,
      relations: ['student', 'answers', 'answers.mentor'],
      order: { created_at: 'DESC' }
    });
  }

  async answerQuestion(mentorId: string, questionId: string, content: string) {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Câu hỏi không tồn tại');

    const answer = this.answerRepo.create({
      mentor_id: mentorId,
      question_id: questionId,
      content
    });

    return this.answerRepo.save(answer);
  }

  /**
   * --- HS CONNECTION ---
   */

  async sendConnectionRequest(requesterId: string, receiverId: string) {
    if (requesterId === receiverId) throw new BadRequestException('Không thể gửi yêu cầu cho chính mình');

    const receiver = await this.userRepo.findOne({ where: { id: receiverId } });
    if (!receiver) throw new NotFoundException('Người dùng không tồn tại');

    const existing = await this.connectionRepo.findOne({
      where: [
        { requester_id: requesterId, receiver_id: receiverId },
        { requester_id: receiverId, receiver_id: requesterId }
      ]
    });

    if (existing) throw new BadRequestException('Yêu cầu đã tồn tại hoặc đã là bạn bè');

    const connection = this.connectionRepo.create({
      requester_id: requesterId,
      receiver_id: receiverId,
      status: 'pending'
    });

    return this.connectionRepo.save(connection);
  }

  async respondToConnectionRequest(userId: string, requestId: string, accept: boolean) {
    const connection = await this.connectionRepo.findOne({ 
        where: { id: requestId, receiver_id: userId, status: 'pending' } 
    });

    if (!connection) throw new NotFoundException('Không tìm thấy yêu cầu');

    connection.status = accept ? 'accepted' : 'rejected';
    return this.connectionRepo.save(connection);
  }

  async getMyNetwork(userId: string) {
    const acceptedConnections = await this.connectionRepo.find({
      where: [
        { requester_id: userId, status: 'accepted' },
        { receiver_id: userId, status: 'accepted' }
      ],
      relations: ['requester', 'receiver']
    });

    const friends = acceptedConnections.map(c => c.requester_id === userId ? c.receiver : c.requester);

    const requests = await this.connectionRepo.find({
      where: { receiver_id: userId, status: 'pending' },
      relations: ['requester']
    });

    return { friends, requests };
  }
}
