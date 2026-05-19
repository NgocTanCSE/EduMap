import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningSpot } from './entities/learning-spot.entity';

@Injectable()
export class LearningCommunityService {
  constructor(
    @InjectRepository(LearningSpot) private spotRepo: Repository<LearningSpot>,
  ) {}

  // 1. Check-in & Ki?m tra t?nh tr?ng ch? tr?ng (Availability & Check-in)
  async checkAvailability(spotId: string) {
    const spot = await this.spotRepo.findOne({ where: { id: spotId } });
    if (!spot) throw new NotFoundException('Ð?a ði?m h?c t?p không t?n t?i');
    
    // Gi? l?p logic tính ch? tr?ng d?a trên s? lý?t check-in hi?n t?i
    const currentOccupancy = 12; // Gi? s?
    const totalCapacity = 30; // T? DB
    const availableSeats = totalCapacity - currentOccupancy;

    return {
      spot_name: spot.name,
      available_seats: availableSeats,
      status: availableSeats > 5 ? 'Available' : (availableSeats > 0 ? 'Almost Full' : 'Full')
    };
  }
}

