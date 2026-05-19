import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mentor, Booking } from './entities/mentor.entity';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class MentorService {
  constructor(
    @InjectRepository(Mentor) private readonly mentorRepo: Repository<Mentor>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Đăng ký trở thành Mentor (Cần Admin duyệt)
   */
  async registerMentor(userId: string, data: any) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản người dùng');

    const existingMentor = await this.mentorRepo.findOne({ where: { user_id: userId } });
    if (existingMentor) throw new BadRequestException('Tài khoản này đã đăng ký làm Mentor');

    const mentor = this.mentorRepo.create({
      user_id: userId,
      bio: data.bio,
      specialties: data.specialties || [],
      experience_years: Number(data.experience_years) || 0,
      hourly_rate: data.hourly_rate ? Number(data.hourly_rate) : null,
      is_verified: false, // Chờ quản trị viên phê duyệt
    });

    return this.mentorRepo.save(mentor);
  }

  /**
   * Lấy danh sách Mentor (Có lọc theo chuyên môn)
   */
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

  /**
   * F-19: Lấy danh sách các slot thời gian rảnh của Mentor
   */
  async getMentorSlots(mentorId: string) {
    const mentor = await this.mentorRepo.findOne({ where: { user_id: mentorId } });
    if (!mentor) throw new NotFoundException('Không tìm thấy Mentor yêu cầu');

    const bookings = await this.bookingRepo.find({
      where: { mentor_id: mentorId, status: 'confirmed' },
      order: { slot_start: 'ASC' },
    });

    // Giả lập 4 slot rảnh cố định trong ngày, đánh dấu nếu trùng lịch đặt trước
    const baseSlots = [
      { start: '09:00', end: '10:00' },
      { start: '10:30', end: '11:30' },
      { start: '14:00', end: '15:00' },
      { start: '16:00', end: '17:00' },
    ];

    return baseSlots.map(slot => {
      // Mock kiểm tra lịch trùng lặp
      const isBooked = bookings.some(b => {
        const startStr = b.slot_start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return startStr === slot.start;
      });

      return {
        ...slot,
        is_booked: isBooked,
      };
    });
  }

  /**
   * F-19: Đặt lịch hẹn tư vấn định hướng với Mentor
   */
  async bookMentor(studentId: string, mentorId: string, slotStart: Date, slotEnd: Date) {
    if (studentId === mentorId) {
      throw new BadRequestException('Bạn không thể tự đặt lịch hẹn tư vấn với chính mình');
    }

    const mentor = await this.mentorRepo.findOne({ where: { user_id: mentorId } });
    if (!mentor) throw new NotFoundException('Không tìm thấy Mentor yêu cầu');

    // Kiểm tra trùng lịch hẹn của học sinh cùng giờ
    const existingStudentBooking = await this.bookingRepo.findOne({
      where: {
        student_id: studentId,
        slot_start: slotStart,
        status: 'confirmed',
      },
    });
    if (existingStudentBooking) {
      throw new BadRequestException('Bạn đã có lịch tư vấn khác được xác nhận tại thời điểm này');
    }

    const booking = this.bookingRepo.create({
      mentor_id: mentorId,
      student_id: studentId,
      slot_start: slotStart,
      slot_end: slotEnd,
      status: 'pending',
      meeting_url: `https://meet.jit.si/edumap-mentor-${mentorId.substring(0, 8)}`,
    });

    return this.bookingRepo.save(booking);
  }

  /**
   * Lấy lịch sử đặt lịch hẹn của Học sinh / Mentee
   */
  async getStudentBookings(studentId: string) {
    return this.bookingRepo.find({
      where: { student_id: studentId },
      relations: ['mentor', 'mentor.user'],
      order: { slot_start: 'DESC' },
    });
  }

  /**
   * Lấy danh sách lịch hẹn của Mentor
   */
  async getMentorBookings(mentorId: string) {
    return this.bookingRepo.find({
      where: { mentor_id: mentorId },
      relations: ['student'],
      order: { slot_start: 'DESC' },
    });
  }
}
