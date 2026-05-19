import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UniversityCounseling } from './entities/hs.entity';

@Injectable()
export class HsConnectionService {
  constructor(
    @InjectRepository(UniversityCounseling) private hsRepo: Repository<UniversityCounseling>,
  ) {}

  // 1. Ðãng k? Campus Tour & Ghép c?p tý v?n (Campus Tour & Mentor Matching)
  async registerCampusTour(studentId: string, universityName: string) {
    return {
      success: true,
      tour_id: 'TOUR-552',
      university: universityName,
      scheduled_date: '2026-06-15T08:00:00Z',
      assigned_mentor: 'Sinh viên nãm 3 - Khoa CNTT' // Ghép c?p tý v?n viên
    };
  }
}

