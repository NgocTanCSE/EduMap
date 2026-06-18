import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mentor, Booking } from './entities/mentor.entity';
import { MentorAvailability } from './entities/mentor-availability.entity';
import { User } from '../auth/entities/user.entity';
import { AIService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MentorService {
  constructor(
    @InjectRepository(Mentor) private readonly mentorRepo: Repository<Mentor>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(MentorAvailability) private readonly availRepo: Repository<MentorAvailability>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly aiService: AIService,
    private readonly notifyService: NotificationsService,
  ) {}

  async registerMentor(userId: string, data: any) {
    const user = await this.userRepo.findOne({ where: { id: userId as any } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản người dùng');

    const existingMentor = await this.mentorRepo.findOne({ where: { user_id: userId } });
    if (existingMentor) throw new BadRequestException('Tài khoản này đã đăng ký làm Mentor');

    const mentor = this.mentorRepo.create({
      user_id: userId,
      bio: data.bio,
      specialties: data.specialties || [],
      experience_years: Number(data.experience_years) || 0,
      hourly_rate: data.hourly_rate ? Number(data.hourly_rate) : null,
      is_verified: false,
    });

    return this.mentorRepo.save(mentor);
  }

  async getMentorById(mentorId: string) {
    const mentor = await this.mentorRepo.findOne({
      where: { user_id: mentorId },
      relations: ['user']
    });
    if (!mentor) throw new NotFoundException('Mentor không tồn tại');
    return mentor;
  }

  async updateBookingStatus(bookingId: string, status: string, userId: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['mentor', 'student']
    });

    if (!booking) throw new NotFoundException('Không tìm thấy lịch hẹn');
    
    if (booking.mentor_id !== userId && booking.student_id !== userId) {
        throw new BadRequestException('Bạn không có quyền cập nhật lịch hẹn này');
    }

    const validTransitions: any = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['completed', 'cancelled'],
        'completed': [],
        'cancelled': []
    };

    if (!validTransitions[booking.status].includes(status)) {
        throw new BadRequestException(`Không thể chuyển trạng thái từ ${booking.status} sang ${status}`);
    }

    booking.status = status;
    const saved = await this.bookingRepo.save(booking);

    const targetUserId = userId === booking.mentor_id ? booking.student_id : booking.mentor_id;
    await this.notifyService.sendNotification(
      targetUserId,
      `Cập nhật lịch hẹn: Lịch hẹn của bạn đã được cập nhật thành: ${status}`,
      'in-app'
    );

    return saved;
  }

  async getMentors(specialty?: string) {
    const queryBuilder = this.mentorRepo
      .createQueryBuilder('mentor')
      .leftJoinAndSelect('mentor.user', 'user')
      .where('mentor.is_verified = :isVerified', { isVerified: true });

    if (specialty) {
      queryBuilder.andWhere("mentor.specialties @> :specialty", {
        specialty: JSON.stringify([specialty]),
      });
    }

    return queryBuilder.orderBy('mentor.rating_avg', 'DESC').getMany();
  }

  async getAIRecommendedMentors(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId as any } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    const verifiedMentors = await this.mentorRepo.find({
      where: { is_verified: true },
      relations: ['user']
    });

    if (verifiedMentors.length === 0) {
      return { message: "Hiện chưa có mentor nào khả dụng." };
    }

    const mentorsData = verifiedMentors.map(m => ({
      id: m.user_id,
      name: m.user?.full_name,
      bio: m.bio,
      specialties: m.specialties
    }));

    const aiInput = {
      student_id: user.id,
      student_skills_needed: user.skills || ['Giao tiếp', 'Định hướng nghề nghiệp'],
      student_mbti: user.mbti_type || 'ENFP',
      preferred_days: ['T7', 'CN'],
      available_mentors: mentorsData
    };

    return this.aiService.matchMentor(aiInput);
  }

  /**
   * Cấu hình lịch rảnh của Mentor
   */
  async addAvailability(mentorId: string, data: { day_of_week: number; start_time: string; end_time: string }) {
    const availability = this.availRepo.create({
      mentor_id: mentorId,
      ...data
    });
    return this.availRepo.save(availability);
  }

  async getMentorAvailability(mentorId: string) {
    return this.availRepo.find({ where: { mentor_id: mentorId, is_active: true } });
  }

  /**
   * Lấy danh sách các slot thời gian rảnh thực tế của Mentor
   */
  async getMentorSlots(mentorId: string, date: string) {
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    const availabilities = await this.availRepo.find({
      where: { mentor_id: mentorId, day_of_week: dayOfWeek, is_active: true }
    });

    const confirmedBookings = await this.bookingRepo.find({
      where: { mentor_id: mentorId, status: 'confirmed' }
    });

    return availabilities.map(avail => {
      const isBooked = confirmedBookings.some(booking => {
        const bookingDate = new Date(booking.slot_start);
        const bookingTime = `${bookingDate.getHours().toString().padStart(2, '0')}:${bookingDate.getMinutes().toString().padStart(2, '0')}`;
        return bookingDate.toDateString() === requestedDate.toDateString() && bookingTime === avail.start_time;
      });

      return {
        id: avail.id,
        start: avail.start_time,
        end: avail.end_time,
        is_booked: isBooked
      };
    });
  }

  async bookMentor(studentId: string, mentorId: string, slotStart: Date, slotEnd: Date) {
    if (studentId === mentorId) throw new BadRequestException('Bạn không thể tự đặt lịch với chính mình');

    const mentor = await this.mentorRepo.findOne({ 
      where: { user_id: mentorId },
      relations: ['user']
    });
    if (!mentor) throw new NotFoundException('Mentor không tồn tại');

    // Kiểm tra xem slot này đã bị đặt chưa
    const existing = await this.bookingRepo.findOne({
      where: {
        mentor_id: mentorId,
        slot_start: slotStart,
        status: 'confirmed'
      }
    });

    if (existing) throw new BadRequestException('Khung giờ này đã có người đặt');

    const booking = this.bookingRepo.create({
      mentor_id: mentorId,
      student_id: studentId,
      slot_start: slotStart,
      slot_end: slotEnd,
      status: 'pending',
      amount: mentor.hourly_rate || 0,
      payment_status: mentor.hourly_rate > 0 ? 'unpaid' : 'paid',
      meeting_url: `https://meet.jit.si/edumap-mentor-${mentorId.substring(0, 8)}`,
    });

    const saved = await this.bookingRepo.save(booking);

    await this.notifyService.sendNotification(
      studentId,
      `Yêu cầu đặt lịch thành công: Bạn đã đặt lịch hẹn với cố vấn ${mentor.user?.full_name}. Vui lòng chờ cố vấn xác nhận.`,
      'in-app'
    );

    return saved;
  }

  async getStudentBookings(studentId: string) {
    return this.bookingRepo.find({
      where: { student_id: studentId },
      relations: ['mentor', 'mentor.user'],
      order: { slot_start: 'DESC' },
    });
  }

  async getMentorBookings(mentorId: string) {
    return this.bookingRepo.find({
      where: { mentor_id: mentorId },
      relations: ['student'],
      order: { slot_start: 'DESC' },
    });
  }
}
