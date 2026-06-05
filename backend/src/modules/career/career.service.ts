import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { CareerPath } from './entities/career.entity';
import { Job, JobStatus } from './entities/job.entity';
import { UserCareer, UserCareerStatus } from './entities/user-career.entity';
import { UserSkill, SkillProficiency } from './entities/user-skill.entity';
import { Application, ApplicationStatus } from './entities/application.entity';
import { User } from '../auth/entities/user.entity';
import { AIService } from '../ai/ai.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { CreateUserCareerDto } from './dto/create-user-career.dto';
import { UpdateUserCareerDto } from './dto/update-user-career.dto';
import { CreateUserSkillDto } from './dto/create-user-skill.dto';
import { UpdateUserSkillDto } from './dto/update-user-skill.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import { StorageService } from '../storage/storage.service'; // New import
@Injectable()
export class CareerService {
  constructor(
    @InjectRepository(CareerPath) private readonly careerPathRepo: Repository<CareerPath>,
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectRepository(UserCareer) private readonly userCareerRepo: Repository<UserCareer>,
    @InjectRepository(UserSkill) private readonly userSkillRepo: Repository<UserSkill>,
    @InjectRepository(Application) private readonly applicationRepo: Repository<Application>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly aiService: AIService,
    private readonly storageService: StorageService, // New injection
  ) {}

  /**
   * Upload resume to storage
   */
  async uploadResume(file: Express.Multer.File) {
    return this.storageService.uploadFile('system', file.originalname, file.buffer, file.mimetype);
  }

  // =====================================
  //  AI Integration (Existing & Enhanced)
  // =====================================

  /**
   * Lấy tư vấn nghề nghiệp cá nhân hóa từ AI Gemini
   * Cập nhật để sử dụng thông tin kỹ năng và nguyện vọng nghề nghiệp chi tiết hơn
   */
  async getAICareerAdvice(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId as any } });
    if (!user) throw new NotFoundException('Không tìm thấy thông tin người dùng');

    const userSkills = await this.userSkillRepo.find({ where: { user_id: userId } });
    const userCareers = await this.userCareerRepo.find({ where: { user_id: userId } });

    // Chuẩn bị dữ liệu gửi sang AI Service
    const aiInput = {
      user_id: user.id,
      full_name: user.full_name,
      skills: userSkills.map(s => `${s.skill_name} (${s.proficiency_level})`),
      mbti_type: user.mbti_type || 'Chưa xác định',
      career_aspirations: userCareers.map(uc => uc.goal_title),
      recent_keywords: 'Phát triển sự nghiệp bền vững' // Có thể lấy từ log tìm kiếm
    };

    return this.aiService.predictCareerPath(aiInput);
  }

  /**
   * Gợi ý nghề nghiệp thông minh (Hybrid: Logic + AI trong tương lai)
   * Cập nhật để sử dụng dữ liệu UserSkill
   */
  async suggestCareer(userId: string) {
    const userSkills = await this.userSkillRepo.find({ where: { user_id: userId } });
    if (!userSkills || userSkills.length === 0) {
      // Fallback hoặc gợi ý các lộ trình nghề nghiệp chung nếu không tìm thấy kỹ năng
      return {
        message: 'Không tìm thấy kỹ năng người dùng. Vui lòng cập nhật hồ sơ kỹ năng để nhận gợi ý tốt hơn.',
        top_suggestions: (await this.careerPathRepo.find()).slice(0, 3).map(path => ({
          career_id: path.id,
          career_title: path.title,
          field: path.field,
          match_rate: '0%',
        })),
      };
    }

    const allPaths = await this.careerPathRepo.find();
    const userSkillNames = userSkills.map(s => s.skill_name.toLowerCase());

    const topSuggestions = allPaths.map(path => {
      const matchedSkills = (path.skills_required || []).filter(skill =>
        userSkillNames.includes(skill.toLowerCase())
      );

      const totalSkillsCount = (path.skills_required || []).length || 1; // Tránh chia cho 0
      const matchPercentage = Math.round((matchedSkills.length / totalSkillsCount) * 100);

      return {
        career_id: path.id,
        career_title: path.title,
        field: path.field,
        match_rate: `${Math.max(matchPercentage, 0)}%`, // Đảm bảo không có phần trăm âm
      };
    });

    topSuggestions.sort((a, b) => parseFloat(b.match_rate) - parseFloat(a.match_rate));

    return {
      input_analysis: { skills: userSkillNames },
      top_suggestions: topSuggestions.slice(0, 5),
    };
  }

  // =====================================
  //  CareerPath Management (Existing)
  // =====================================

  /**
   * Tạo lộ trình nghề nghiệp mới
   */
  async createCareerPath(data: any) {
    const career = this.careerPathRepo.create(data);
    return this.careerPathRepo.save(career);
  }

  /**
   * Lấy danh sách lộ trình nghề nghiệp theo ngành nghề hoặc tất cả
   */
  async getCareerPaths(field?: string) {
    const whereClause = field ? { field } : {};
    return this.careerPathRepo.find({
      where: whereClause,
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Lấy chi tiết một lộ trình nghề nghiệp
   */
  async getCareerPathById(id: string) {
    const careerPath = await this.careerPathRepo.findOne({ where: { id } });
    if (!careerPath) throw new NotFoundException('Lộ trình nghề nghiệp không tìm thấy.');
    return careerPath;
  }

  /**
   * Lộ trình phát triển kỹ năng (Skill Roadmap)
   */
  async getSkillRoadmap(careerId: string) {
    const career = await this.careerPathRepo.findOne({ where: { id: careerId } });
    if (!career) throw new NotFoundException('Không tìm thấy lộ trình nghề nghiệp yêu cầu');

    return {
      career_id: career.id,
      career_title: career.title,
      field: career.field,
      description: career.description,
      skills_required: career.skills_required || [],
      roadmap: career.roadmap_json || [
        { phase: 'Beginner', skills: ['HTML', 'CSS', 'Basic Logic'] },
        { phase: 'Intermediate', skills: ['TypeScript', 'Node.js', 'Database'] },
        { phase: 'Advanced', skills: ['System Architecture', 'CI/CD'] }
      ]
    };
  }

  // =====================================
  //  Job Management
  // =====================================

  /**
   * Tạo một Job/Cơ hội mới
   * @param createJobDto DTO chứa thông tin Job
   * @param userId ID của người dùng đăng Job
   */
  async createJob(createJobDto: CreateJobDto, userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng đăng Job không tồn tại.');

    const job = this.jobRepo.create({
      ...createJobDto,
      posted_by_user_id: userId,
      posted_by: user,
    });
    return this.jobRepo.save(job);
  }

  /**
   * Tìm kiếm và lọc Job/Cơ hội
   * @param searchDto DTO chứa các tiêu chí tìm kiếm
   */
  async searchJobs(searchDto: any) {
    const { keyword, location, job_type, experience_level, salary_range, career_path_id, page = 1, limit = 10 } = searchDto;
    const query = this.jobRepo.createQueryBuilder('job');

    if (keyword) {
      query.andWhere(
        '(LOWER(job.title) LIKE LOWER(:keyword) OR LOWER(job.description) LIKE LOWER(:keyword) OR LOWER(job.company_name) LIKE LOWER(:keyword))',
        { keyword: `%${keyword}%` }
      );
    }
    if (location) {
      query.andWhere('LOWER(job.location) LIKE LOWER(:location)', { location: `%${location}%` });
    }
    if (job_type) {
      query.andWhere('job.job_type = :job_type', { job_type });
    }
    if (experience_level) {
      query.andWhere('LOWER(job.experience_level) LIKE LOWER(:experience_level)', { experience_level: `%${experience_level}%` });
    }
    if (salary_range) {
        // Simple exact match for now, can be expanded to range search
        query.andWhere('job.salary_range = :salary_range', { salary_range });
    }
    if (career_path_id) {
        query.andWhere('job.career_path_id = :career_path_id', { career_path_id });
    }

    const [jobs, total] = await query
      .where('job.status = :status', { status: JobStatus.ACTIVE }) // Chỉ hiển thị các công việc đang hoạt động
      .orderBy('job.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { jobs, total, page, limit };
  }

  /**
   * Lấy chi tiết một Job/Cơ hội
   */
  async getJobById(id: string) {
    const job = await this.jobRepo.findOne({
      where: { id },
      relations: ['posted_by', 'career_path'], // Tải thông tin người dùng và lộ trình nghề nghiệp liên quan
    });
    if (!job) throw new NotFoundException('Job không tìm thấy.');

    // Tăng số lượt xem
    job.views += 1;
    await this.jobRepo.save(job);

    return job;
  }

  /**
   * Cập nhật thông tin Job/Cơ hội
   * @param id ID của Job cần cập nhật
   * @param updateJobDto DTO chứa thông tin cập nhật
   * @param userId ID của người dùng thực hiện cập nhật (để kiểm tra quyền)
   */
  async updateJob(id: string, updateJobDto: UpdateJobDto, userId: string) {
    const job = await this.jobRepo.findOne({ where: { id, posted_by_user_id: userId } });
    if (!job) throw new NotFoundException('Job không tìm thấy hoặc bạn không có quyền chỉnh sửa.');

    this.jobRepo.merge(job, updateJobDto);
    return this.jobRepo.save(job);
  }

  /**
   * Xóa Job/Cơ hội
   * @param id ID của Job cần xóa
   * @param userId ID của người dùng thực hiện xóa (để kiểm tra quyền)
   */
  async deleteJob(id: string, userId: string) {
    const result = await this.jobRepo.delete({ id, posted_by_user_id: userId });
    if (result.affected === 0) {
      throw new NotFoundException('Job không tìm thấy hoặc bạn không có quyền xóa.');
    }
    return { message: 'Job đã được xóa thành công.' };
  }


  // =====================================
  //  UserCareer Management
  // =====================================

  /**
   * Tạo/Cập nhật nguyện vọng nghề nghiệp cho người dùng
   */
  async createUserCareer(userId: string, createUserCareerDto: CreateUserCareerDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại.');

    const careerPath = await this.careerPathRepo.findOne({ where: { id: createUserCareerDto.career_path_id } });
    // Có thể tạo UserCareer mà không liên kết với CareerPath hiện có
    // if (!careerPath) throw new NotFoundException('Lộ trình nghề nghiệp không tìm thấy.');

    const userCareer = this.userCareerRepo.create({
      ...createUserCareerDto,
      user_id: userId,
      user: user,
      career_path: careerPath,
    });
    return this.userCareerRepo.save(userCareer);
  }

  /**
   * Lấy tất cả nguyện vọng nghề nghiệp của một người dùng
   */
  async getUserCareers(userId: string) {
    return this.userCareerRepo.find({
      where: { user_id: userId },
      relations: ['career_path'], // Tải thông tin lộ trình nghề nghiệp liên quan
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Cập nhật nguyện vọng nghề nghiệp
   */
  async updateUserCareer(id: string, userId: string, updateUserCareerDto: UpdateUserCareerDto) {
    const userCareer = await this.userCareerRepo.findOne({ where: { id, user_id: userId } });
    if (!userCareer) throw new NotFoundException('Nguyện vọng nghề nghiệp không tìm thấy hoặc bạn không có quyền chỉnh sửa.');

    if (updateUserCareerDto.career_path_id) {
        const careerPath = await this.careerPathRepo.findOne({ where: { id: updateUserCareerDto.career_path_id } });
        userCareer.career_path = careerPath;
    }

    this.userCareerRepo.merge(userCareer, updateUserCareerDto);
    return this.userCareerRepo.save(userCareer);
  }

  /**
   * Xóa nguyện vọng nghề nghiệp
   */
  async deleteUserCareer(id: string, userId: string) {
    const result = await this.userCareerRepo.delete({ id, user_id: userId });
    if (result.affected === 0) {
      throw new NotFoundException('Nguyện vọng nghề nghiệp không tìm thấy hoặc bạn không có quyền xóa.');
    }
    return { message: 'Nguyện vọng nghề nghiệp đã được xóa thành công.' };
  }


  // =====================================
  //  UserSkill Management
  // =====================================

  /**
   * Thêm/Cập nhật kỹ năng cho người dùng
   */
  async createUserSkill(userId: string, createUserSkillDto: CreateUserSkillDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại.');

    const existingSkill = await this.userSkillRepo.findOne({ where: { user_id: userId, skill_name: createUserSkillDto.skill_name } });
    if (existingSkill) {
      this.userSkillRepo.merge(existingSkill, createUserSkillDto);
      return this.userSkillRepo.save(existingSkill);
    }

    const userSkill = this.userSkillRepo.create({
      ...createUserSkillDto,
      user_id: userId,
      user: user,
    });
    return this.userSkillRepo.save(userSkill);
  }

  /**
   * Lấy tất cả kỹ năng của một người dùng
   */
  async getUserSkills(userId: string) {
    return this.userSkillRepo.find({ where: { user_id: userId }, order: { skill_name: 'ASC' } });
  }

  /**
   * Cập nhật kỹ năng người dùng
   */
  async updateUserSkill(id: string, userId: string, updateUserSkillDto: UpdateUserSkillDto) {
    const userSkill = await this.userSkillRepo.findOne({ where: { id, user_id: userId } });
    if (!userSkill) throw new NotFoundException('Kỹ năng không tìm thấy hoặc bạn không có quyền chỉnh sửa.');

    this.userSkillRepo.merge(userSkill, updateUserSkillDto);
    return this.userSkillRepo.save(userSkill);
  }

  /**
   * Xóa kỹ năng người dùng
   */
  async deleteUserSkill(id: string, userId: string) {
    const result = await this.userSkillRepo.delete({ id, user_id: userId });
    if (result.affected === 0) {
      throw new NotFoundException('Kỹ năng không tìm thấy hoặc bạn không có quyền xóa.');
    }
    return { message: 'Kỹ năng đã được xóa thành công.' };
  }


  // =====================================
  //  Application Management
  // =====================================

  /**
   * Người dùng ứng tuyển vào một Job/Cơ hội
   * @param userId ID người dùng ứng tuyển
   * @param applyJobDto DTO chứa thông tin ứng tuyển
   */
  async applyToJob(userId: string, applyJobDto: ApplyJobDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại.');

    const job = await this.jobRepo.findOne({ where: { id: applyJobDto.job_id } });
    if (!job) throw new NotFoundException('Job không tìm thấy.');

    // Kiểm tra xem người dùng đã ứng tuyển vào công việc này chưa
    const existingApplication = await this.applicationRepo.findOne({ where: { user_id: userId, job_id: applyJobDto.job_id } });
    if (existingApplication) {
      throw new ConflictException('Bạn đã ứng tuyển vào Job này rồi.');
    }

    const application = this.applicationRepo.create({
      ...applyJobDto,
      user_id: userId,
      user: user,
      job: job,
      status: ApplicationStatus.PENDING, // Trạng thái mặc định
    });
    return this.applicationRepo.save(application);
  }

  /**
   * Lấy tất cả các ứng tuyển của một người dùng
   */
  async getUserApplications(userId: string) {
    return this.applicationRepo.find({
      where: { user_id: userId },
      relations: ['job'], // Tải thông tin công việc liên quan
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Lấy chi tiết một ứng tuyển
   */
  async getApplicationById(id: string, userId: string) {
    const application = await this.applicationRepo.findOne({ where: { id, user_id: userId } });
    if (!application) throw new NotFoundException('Ứng tuyển không tìm thấy hoặc bạn không có quyền xem.');
    return application;
  }

  /**
   * Cập nhật trạng thái ứng tuyển (chỉ dành cho người đăng Job hoặc Admin)
   */
  async updateApplicationStatus(id: string, status: ApplicationStatus, currentUserId: string, currentUserRole: string) {
    const application = await this.applicationRepo.findOne({ where: { id }, relations: ['job'] });
    if (!application) throw new NotFoundException('Ứng tuyển không tìm thấy.');

    // Kiểm tra quyền: chỉ người đăng công việc hoặc admin mới có thể cập nhật trạng thái
    if (currentUserRole !== 'admin' && application.job.posted_by_user_id !== currentUserId) {
        throw new NotFoundException('Bạn không có quyền cập nhật trạng thái ứng tuyển này.');
    }

    application.status = status;
    return this.applicationRepo.save(application);
  }

  /**
   * Rút lại ứng tuyển
   */
  async withdrawApplication(id: string, userId: string) {
    const application = await this.applicationRepo.findOne({ where: { id, user_id: userId } });
    if (!application) throw new NotFoundException('Ứng tuyển không tìm thấy hoặc bạn không có quyền rút.');

    if (application.status === ApplicationStatus.ACCEPTED || application.status === ApplicationStatus.REJECTED) {
      throw new ConflictException('Không thể rút ứng tuyển đã được chấp nhận hoặc từ chối.');
    }

    application.status = ApplicationStatus.WITHDRAWN;
    return this.applicationRepo.save(application);
  }

}
