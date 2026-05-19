import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CareerPath } from './entities/career.entity';

@Injectable()
export class CareerService {
  constructor(
    @InjectRepository(CareerPath) private readonly careerRepo: Repository<CareerPath>,
  ) {}

  /**
   * Tạo lộ trình nghề nghiệp mới
   */
  async createCareerPath(data: any) {
    const career = this.careerRepo.create(data);
    return this.careerRepo.save(career);
  }

  /**
   * Lấy danh sách lộ trình nghề nghiệp theo ngành nghề hoặc tất cả
   */
  async getCareerPaths(field?: string) {
    const whereClause = field ? { field } : {};
    return this.careerRepo.find({
      where: whereClause,
      order: { created_at: 'DESC' },
    });
  }

  /**
   * F-14: Lộ trình phát triển kỹ năng (Skill Roadmap)
   * Sửa lỗi truy xuất thuộc tính career.name không tồn tại sang career.title
   */
  async getSkillRoadmap(careerId: string) {
    const career = await this.careerRepo.findOne({ where: { id: careerId } });
    if (!career) throw new NotFoundException('Không tìm thấy lộ trình nghề nghiệp yêu cầu');

    return {
      career_id: career.id,
      career_title: career.title,
      field: career.field,
      description: career.description,
      skills_required: career.skills_required || [],
      roadmap: career.roadmap_json || [
        { phase: 'Beginner', skills: ['HTML', 'CSS', 'Basic Logic', 'Cơ bản về Git'] },
        { phase: 'Intermediate', skills: ['TypeScript', 'React / Next.js', 'NestJS / Express', 'Database SQL/NoSQL'] },
        { phase: 'Advanced', skills: ['Kiến trúc Hệ thống', 'Tối ưu hóa Hiệu năng (Performance)', 'CI/CD & Cloud Infrastructure'] }
      ]
    };
  }

  /**
   * Gợi ý nghề nghiệp thông minh (AI Career Suggestion)
   */
  async suggestCareer(userSkills: string[], interests: string[]) {
    // Tìm kiếm các lộ trình phù hợp từ CSDL
    const allPaths = await this.careerRepo.find();

    const topSuggestions = allPaths.map(path => {
      // Tính toán phần trăm tương thích kỹ năng cơ bản
      const matchedSkills = (path.skills_required || []).filter(skill =>
        userSkills.some(userSkill => userSkill.toLowerCase().includes(skill.toLowerCase()))
      );

      const missingSkills = (path.skills_required || []).filter(skill =>
        !userSkills.some(userSkill => userSkill.toLowerCase().includes(skill.toLowerCase()))
      );

      const totalSkillsCount = (path.skills_required || []).length || 5;
      const matchPercentage = Math.round((matchedSkills.length / totalSkillsCount) * 100);

      return {
        career_id: path.id,
        career_title: path.title,
        field: path.field,
        match_rate: `${Math.max(matchPercentage, 35)}%`,
        missing_skills: missingSkills.length > 0 ? missingSkills : ['Không có kỹ năng còn thiếu'],
      };
    });

    // Sắp xếp các gợi ý có độ tương thích từ cao xuống thấp
    topSuggestions.sort((a, b) => parseFloat(b.match_rate) - parseFloat(a.match_rate));

    return {
      input_analysis: { skills: userSkills, interests },
      top_suggestions: topSuggestions.slice(0, 3),
    };
  }
}
