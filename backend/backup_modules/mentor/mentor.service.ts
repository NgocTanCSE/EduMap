import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MentorBooking } from './entities/mentor.entity';

@Injectable()
export class MentorService {
  constructor(
    @InjectRepository(MentorBooking) private bookingRepo: Repository<MentorBooking>,
  ) {}

  // F-19: L?ch r?nh & Ð?t l?ch Mentor
  async getMentorSlots(mentorId: string) {
    // Truy v?n b?ng mentor_slots
    return [{ start: '09:00', end: '10:00', is_booked: false }];
  }

  async bookMentor(userId: string, data: any) {
    const booking = this.bookingRepo.create({ ...data, mentee_id: userId, status: 'pending' });
    return this.bookingRepo.save(booking);
  }
}

