import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { UniversityCounseling } from './entities/hs.entity';
import { StudentConnection } from './entities/student-connection.entity';
import { User, UserRole } from '../auth/entities/user.entity';

@Injectable()
export class HsConnectionService {
  constructor(
    @InjectRepository(UniversityCounseling) private readonly hsRepo: Repository<UniversityCounseling>,
    @InjectRepository(StudentConnection) private readonly connectionRepo: Repository<StudentConnection>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Tạo hồ sơ thông tin tư vấn tuyển sinh đại học mới
   */
  async createCounselingInfo(data: any) {
    const counseling = this.hsRepo.create(data);
    return this.hsRepo.save(counseling);
  }

  /**
   * Lấy danh sách hồ sơ tuyển sinh đại học phục vụ tư vấn học sinh THPT
   */
  async getCounselingList() {
    return this.hsRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * F-29: Đăng ký Campus Tour ảo & Ghép cặp sinh viên đại học tư vấn đồng hành (Mentor Matching)
   */
  async registerCampusTour(studentId: string, universityName: string) {
    const tourId = `TOUR-${Math.floor(100 + Math.random() * 900)}`;

    const mentors = [
      'Sinh viên năm 3 - Khoa Công nghệ thông tin',
      'Sinh viên năm 4 - Khoa Kinh tế đối ngoại',
      'Thủ khoa tuyển sinh đầu vào - Viện Đào tạo Quốc tế',
      'Ủy viên BCH Hội Sinh viên - Ban Hỗ trợ Học tập',
    ];
    const assignedMentor = mentors[Math.floor(Math.random() * mentors.length)];

    return {
      success: true,
      message: `Đăng ký tham quan Virtual Campus Tour tại trường ${universityName} thành công. Chúng tôi đã ghép cặp người đồng hành cho bạn.`,
      tour_id: tourId,
      university: universityName,
      scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 08:30:00',
      assigned_mentor: assignedMentor,
      student_id: studentId,
    };
  }

  /**
   * --- HS CONNECTION (SOCIAL NETWORK) ---
   */

  /**
   * Gửi yêu cầu kết nối
   */
  async sendConnectionRequest(requesterId: string, receiverId: string) {
    if (requesterId === receiverId) {
      throw new BadRequestException('Không thể gửi yêu cầu kết nối cho chính mình');
    }

    const receiver = await this.userRepo.findOne({ where: { id: receiverId } });
    if (!receiver) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    // Defensive: Check if request already exists in either direction
    const existing = await this.connectionRepo.findOne({
      where: [
        { requester_id: requesterId, receiver_id: receiverId },
        { requester_id: receiverId, receiver_id: requesterId }
      ]
    });

    if (existing) {
      if (existing.status === 'accepted') {
        throw new BadRequestException('Hai bạn đã là bạn bè');
      }
      throw new BadRequestException('Yêu cầu kết nối đã tồn tại');
    }

    const connection = this.connectionRepo.create({
      requester_id: requesterId,
      receiver_id: receiverId,
      status: 'pending'
    });

    await this.connectionRepo.save(connection);
    return { success: true, message: 'Đã gửi yêu cầu kết nối' };
  }

  /**
   * Chấp nhận hoặc Từ chối yêu cầu kết nối
   */
  async respondToConnectionRequest(userId: string, requestId: string, accept: boolean) {
    const connection = await this.connectionRepo.findOne({ 
        where: { id: requestId, receiver_id: userId, status: 'pending' } 
    });

    if (!connection) {
      throw new NotFoundException('Không tìm thấy yêu cầu kết nối hợp lệ');
    }

    connection.status = accept ? 'accepted' : 'rejected';
    await this.connectionRepo.save(connection);

    return { 
        success: true, 
        message: accept ? 'Đã chấp nhận yêu cầu kết nối' : 'Đã từ chối yêu cầu kết nối' 
    };
  }

  /**
   * Lấy danh sách bạn bè & Yêu cầu kết nối
   */
  async getMyNetwork(userId: string) {
    // 1. Bạn bè (Accepted both ways)
    const acceptedConnections = await this.connectionRepo.find({
      where: [
        { requester_id: userId, status: 'accepted' },
        { receiver_id: userId, status: 'accepted' }
      ],
      relations: ['requester', 'receiver']
    });

    const friends = acceptedConnections.map(c => {
      const friend = c.requester_id === userId ? c.receiver : c.requester;
      return {
        id: friend.id,
        full_name: friend.full_name,
        avatar_url: friend.avatar_url,
        level: friend.level,
        points: friend.points,
        connection_id: c.id
      };
    });

    // 2. Yêu cầu đang chờ xác nhận (Pending received)
    const pendingRequests = await this.connectionRepo.find({
      where: { receiver_id: userId, status: 'pending' },
      relations: ['requester']
    });

    const requests = pendingRequests.map(c => ({
      id: c.requester.id,
      full_name: c.requester.full_name,
      avatar_url: c.requester.avatar_url,
      level: c.requester.level,
      connection_id: c.id,
      created_at: c.created_at
    }));

    // 3. Gợi ý kết bạn (Exclude self, current friends, and pending requests)
    const existingConnectionIds = [
      userId,
      ...acceptedConnections.map(c => c.requester_id === userId ? c.receiver_id : c.requester_id),
      ...pendingRequests.map(c => c.requester_id),
      ...(await this.connectionRepo.find({ where: { requester_id: userId }, select: ['receiver_id'] })).map(c => c.receiver_id)
    ];

    const suggestions = await this.userRepo.find({
      where: { 
          id: Not(In(existingConnectionIds)),
          role_id: 11 // STUDENT
      },
      select: ['id', 'full_name', 'avatar_url', 'level', 'points', 'bio'],
      take: 10,
      order: { points: 'DESC' }
    });

    return {
      friends,
      requests,
      suggestions
    };
  }
}
