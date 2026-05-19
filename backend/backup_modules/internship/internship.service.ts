import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Internship } from './entities/internship.entity';

@Injectable()
export class InternshipService {
  constructor(
    @InjectRepository(Internship) private internRepo: Repository<Internship>,
  ) {}

  // N?p CV th?c t?p (Apply)
  async applyInternship(userId: string, internshipId: string, coverLetter: string) {
    return { success: true, tracking_id: 'INT-' + Date.now(), status: 'reviewing' };
  }
}
