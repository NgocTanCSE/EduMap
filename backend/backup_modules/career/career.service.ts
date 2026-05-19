import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CareerPath } from './entities/career.entity';

@Injectable()
export class CareerService {
  constructor(
    @InjectRepository(CareerPath) private careerRepo: Repository<CareerPath>,
  ) {}

  // 1. L? tr?nh phát tri?n k? nãng (Skill Roadmap)
  async getSkillRoadmap(careerId: string) {
    const career = await this.careerRepo.findOne({ where: { id: careerId } });
    if (!career) return null;
    
    // Gi? l?p tr? v? c?u trúc phân c?p k? nãng (Roadmap tree)
    return {
      career_name: career.name,
      roadmap: [
        { phase: 'Beginner', skills: ['HTML', 'CSS', 'Basic Logic'] },
        { phase: 'Intermediate', skills: ['JavaScript', 'React', 'Git'] },
        { phase: 'Advanced', skills: ['System Design', 'Performance Optimization'] }
      ]
    };
  }

  // 2. G?i ? ngh? nghi?p thông minh (AI Career Suggestion)
  async suggestCareer(userSkills: string[], interests: string[]) {
    // Logic: G?i sang AI Service ð? phân tích và mapping k? nãng hi?n t?i
    // v?i các l? tr?nh ngh? nghi?p có s?n trong DB.
    
    // K?t qu? mô ph?ng tr? v?:
    return {
      input_analysis: { skills: userSkills, interests },
      top_suggestions: [
        { career: 'Frontend Developer', match_rate: '90%', missing_skills: ['React'] },
        { career: 'UI/UX Designer', match_rate: '75%', missing_skills: ['Figma', 'Wireframing'] }
      ]
    };
  }
}

