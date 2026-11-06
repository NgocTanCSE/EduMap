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
import { StorageService } from '../storage/storage.service';
@Injectable()
export class CareerService {
    constructor(
    @InjectRepository(CareerPath)
    private readonly careerPathRepo: Repository<CareerPath>, 
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>, 
    @InjectRepository(UserCareer)
    private readonly userCareerRepo: Repository<UserCareer>, 
    @InjectRepository(UserSkill)
    private readonly userSkillRepo: Repository<UserSkill>, 
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>, 
    @InjectRepository(User)
    private readonly userRepo: Repository<User>, private readonly aiService: AIService, private readonly storageService: StorageService) { }
    async uploadResume(userId: string, file: Express.Multer.File) {
        return this.storageService.uploadFile(userId, file.originalname, file.buffer, file.mimetype);
    }
    async getAICareerAdvice(userId: string) {
        const user = await this.userRepo.findOne({ where: { id: userId as any } });
        if (!user)
            throw new NotFoundException('Không tìm thấy thông tin người dùng');
        const userSkills = await this.userSkillRepo.find({ where: { user_id: userId } });
        const userCareers = await this.userCareerRepo.find({ where: { user_id: userId } });
        const aiInput = {
            user_id: user.id,
            full_name: user.full_name,
            skills: userSkills.map(s => `${s.skill_name} (${s.proficiency_level})`),
            mbti_type: user.mbti_type || 'Chưa xác định',
            career_aspirations: userCareers.map(uc => uc.goal_title),
            recent_keywords: 'Phát triển sự nghiệp bền vững'
        };
        return this.aiService.predictCareerPath(aiInput);
    }
    async suggestCareer(userId: string) {
        const userSkills = await this.userSkillRepo.find({ where: { user_id: userId } });
        const userSkillNames = userSkills.map(s => s.skill_name.toLowerCase());
        const userCareers = await this.userCareerRepo.find({ where: { user_id: userId } });
        const interests = userCareers.map(uc => (uc.goal_title || `CareerPath_${uc.career_path_id}` || '')).filter(Boolean);
        const allPaths = await this.careerPathRepo.find();
        const aiResult = await this.aiService.recommendCareerSemantic(userSkillNames, interests, 'beginner', userId).catch(() => null);
        if (aiResult?.top_careers?.length > 0) {
            const suggestions = aiResult.top_careers.map((c: any) => {
                const match = allPaths.find(p => p.title.toLowerCase() === (c.title || '').toLowerCase());
                return {
                    career_id: match ? match.id : null,
                    title: c.title,
                    field: c.field || match?.field || '',
                    match_score: c.match_score,
                    explanation: c.explanation,
                    missing_skills: c.missing_skills,
                    demand_level: c.demand_level || 'Cao',
                    radar_chart: c.radar_chart,
                };
            });
            return {
                input_analysis: { skills: userSkillNames, interests },
                top_suggestions: suggestions,
                degraded: aiResult.degraded || false,
                source: aiResult.source || 'semantic',
            };
        }
        return {
            input_analysis: { skills: userSkillNames, interests },
            top_suggestions: [
                {
                    career_id: null,
                    title: 'AI Engineer / Machine Learning Engineer',
                    field: 'Công nghệ thông tin',
                    match_score: 85,
                    explanation: 'Ngành công nghệ thông tin và AI đang là xu hướng phát triển mạnh.',
                    missing_skills: ['Python', 'Machine Learning', 'Statistics'],
                    demand_level: 'Cao',
                },
                {
                    career_id: null,
                    title: 'Fullstack Developer',
                    field: 'Công nghệ thông tin',
                    match_score: 78,
                    explanation: 'Lĩnh vực phát triển web fullstack luôn có nhu cầu ổn định.',
                    missing_skills: ['TypeScript', 'React', 'Node.js'],
                    demand_level: 'Cao',
                },
                {
                    career_id: null,
                    title: 'Data Scientist',
                    field: 'Công nghệ thông tin',
                    match_score: 72,
                    explanation: 'Phân tích dữ liệu và khai phá thông tin ngành đang tăng trưởng.',
                    missing_skills: ['Python', 'Pandas', 'Statistics'],
                    demand_level: 'Trung bình',
                },
            ],
            degraded: true,
            source: 'template-fallback',
        };
    }
    async createCareerPath(data: any) {
        const career = this.careerPathRepo.create(data);
        const saved = await this.careerPathRepo.save(career);
        this.aiService.triggerKnowledgeSync();
        return saved;
    }
    async getCareerPaths(field?: string) {
        const whereClause = field ? { field } : {};
        return this.careerPathRepo.find({
            where: whereClause,
            order: { created_at: 'DESC' },
        });
    }
    async getCareerPathById(id: string) {
        const careerPath = await this.careerPathRepo.findOne({ where: { id: Number(id) } });
        if (!careerPath)
            throw new NotFoundException('Lộ trình nghề nghiệp không tìm thấy.');
        return careerPath;
    }
    async getSkillRoadmap(careerId: string) {
        const career = await this.careerPathRepo.findOne({ where: { id: Number(careerId) } });
        if (!career)
            throw new NotFoundException('Không tìm thấy lộ trình nghề nghiệp yêu cầu');
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
    async createJob(createJobDto: CreateJobDto, userId: string) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user)
            throw new NotFoundException('Người dùng đăng Job không tồn tại.');
        const job = this.jobRepo.create({
            ...createJobDto,
            posted_by_user_id: userId,
            posted_by: user,
        });
        const saved = await this.jobRepo.save(job);
        this.aiService.triggerKnowledgeSync();
        return saved;
    }
    async searchJobs(searchDto: any) {
        const { keyword, location, job_type, experience_level, salary_range, career_path_id, page = 1, limit = 10 } = searchDto;
        const query = this.jobRepo.createQueryBuilder('job');
        if (keyword) {
            query.andWhere('(LOWER(job.title) LIKE LOWER(:keyword) OR LOWER(job.description) LIKE LOWER(:keyword) OR LOWER(job.company_name) LIKE LOWER(:keyword))', { keyword: `%${keyword}%` });
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
            query.andWhere('job.salary_range = :salary_range', { salary_range });
        }
        if (career_path_id) {
            query.andWhere('job.career_path_id = :career_path_id', { career_path_id });
        }
        const [jobs, total] = await query
            .andWhere('job.status = :status', { status: JobStatus.ACTIVE })
            .orderBy('job.created_at', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();
        return { jobs, total, page, limit };
    }
    async getJobById(id: string) {
        const job = await this.jobRepo.findOne({
            where: { id },
            relations: ['posted_by', 'career_path'],
        });
        if (!job)
            throw new NotFoundException('Job không tìm thấy.');
        job.views += 1;
        await this.jobRepo.save(job);
        return job;
    }
    async updateJob(id: string, updateJobDto: UpdateJobDto, userId: string) {
        const job = await this.jobRepo.findOne({ where: { id, posted_by_user_id: userId } });
        if (!job)
            throw new NotFoundException('Job không tìm thấy hoặc bạn không có quyền chỉnh sửa.');
        this.jobRepo.merge(job, updateJobDto);
        return this.jobRepo.save(job);
    }
    async deleteJob(id: string, userId: string) {
        const result = await this.jobRepo.delete({ id, posted_by_user_id: userId });
        if (result.affected === 0) {
            throw new NotFoundException('Job không tìm thấy hoặc bạn không có quyền xóa.');
        }
        return { message: 'Job đã được xóa thành công.' };
    }
    async createUserCareer(userId: string, createUserCareerDto: CreateUserCareerDto) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user)
            throw new NotFoundException('Người dùng không tồn tại.');
        const careerPath = await this.careerPathRepo.findOne({ where: { id: createUserCareerDto.career_path_id } });
        const userCareer = this.userCareerRepo.create({
            ...createUserCareerDto,
            user_id: userId,
            user: user,
            career_path: careerPath,
        });
        return this.userCareerRepo.save(userCareer);
    }
    async getUserCareers(userId: string) {
        return this.userCareerRepo.find({
            where: { user_id: userId },
            relations: ['career_path'],
            order: { created_at: 'DESC' },
        });
    }
    async updateUserCareer(id: string, userId: string, updateUserCareerDto: UpdateUserCareerDto) {
        const userCareer = await this.userCareerRepo.findOne({ where: { id, user_id: userId } });
        if (!userCareer)
            throw new NotFoundException('Nguyện vọng nghề nghiệp không tìm thấy hoặc bạn không có quyền chỉnh sửa.');
        if (updateUserCareerDto.career_path_id) {
            const careerPath = await this.careerPathRepo.findOne({ where: { id: updateUserCareerDto.career_path_id } });
            userCareer.career_path = careerPath;
        }
        this.userCareerRepo.merge(userCareer, updateUserCareerDto);
        return this.userCareerRepo.save(userCareer);
    }
    async deleteUserCareer(id: string, userId: string) {
        const result = await this.userCareerRepo.delete({ id, user_id: userId });
        if (result.affected === 0) {
            throw new NotFoundException('Nguyện vọng nghề nghiệp không tìm thấy hoặc bạn không có quyền xóa.');
        }
        return { message: 'Nguyện vọng nghề nghiệp đã được xóa thành công.' };
    }
    async createUserSkill(userId: string, createUserSkillDto: CreateUserSkillDto) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user)
            throw new NotFoundException('Người dùng không tồn tại.');
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
    async getUserSkills(userId: string) {
        return this.userSkillRepo.find({ where: { user_id: userId }, order: { skill_name: 'ASC' } });
    }
    async updateUserSkill(id: string, userId: string, updateUserSkillDto: UpdateUserSkillDto) {
        const userSkill = await this.userSkillRepo.findOne({ where: { id, user_id: userId } });
        if (!userSkill)
            throw new NotFoundException('Kỹ năng không tìm thấy hoặc bạn không có quyền chỉnh sửa.');
        this.userSkillRepo.merge(userSkill, updateUserSkillDto);
        return this.userSkillRepo.save(userSkill);
    }
    async deleteUserSkill(id: string, userId: string) {
        const result = await this.userSkillRepo.delete({ id, user_id: userId });
        if (result.affected === 0) {
            throw new NotFoundException('Kỹ năng không tìm thấy hoặc bạn không có quyền xóa.');
        }
        return { message: 'Kỹ năng đã được xóa thành công.' };
    }
    async applyToJob(userId: string, applyJobDto: ApplyJobDto) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user)
            throw new NotFoundException('Người dùng không tồn tại.');
        const job = await this.jobRepo.findOne({ where: { id: applyJobDto.job_id } });
        if (!job)
            throw new NotFoundException('Job không tìm thấy.');
        const existingApplication = await this.applicationRepo.findOne({ where: { user_id: userId, job_id: applyJobDto.job_id } });
        if (existingApplication) {
            throw new ConflictException('Bạn đã ứng tuyển vào Job này rồi.');
        }
        const application = this.applicationRepo.create({
            ...applyJobDto,
            user_id: userId,
            user: user,
            job: job,
            status: ApplicationStatus.PENDING,
        });
        return this.applicationRepo.save(application);
    }
    async getUserApplications(userId: string) {
        return this.applicationRepo.find({
            where: { user_id: userId },
            relations: ['job'],
            order: { created_at: 'DESC' },
        });
    }
    async getApplicationById(id: string, userId: string) {
        const application = await this.applicationRepo.findOne({ where: { id, user_id: userId } });
        if (!application)
            throw new NotFoundException('Ứng tuyển không tìm thấy hoặc bạn không có quyền xem.');
        return application;
    }
    async updateApplicationStatus(id: string, status: ApplicationStatus, currentUserId: string, currentUserRole: string) {
        const application = await this.applicationRepo.findOne({ where: { id }, relations: ['job'] });
        if (!application)
            throw new NotFoundException('Ứng tuyển không tìm thấy.');
        if (currentUserRole !== 'admin' && application.job.posted_by_user_id !== currentUserId) {
            throw new NotFoundException('Bạn không có quyền cập nhật trạng thái ứng tuyển này.');
        }
        application.status = status;
        return this.applicationRepo.save(application);
    }
    async withdrawApplication(id: string, userId: string) {
        const application = await this.applicationRepo.findOne({ where: { id, user_id: userId } });
        if (!application)
            throw new NotFoundException('Ứng tuyển không tìm thấy hoặc bạn không có quyền rút.');
        if (application.status === ApplicationStatus.ACCEPTED || application.status === ApplicationStatus.REJECTED) {
            throw new ConflictException('Không thể rút ứng tuyển đã được chấp nhận hoặc từ chối.');
        }
        application.status = ApplicationStatus.WITHDRAWN;
        return this.applicationRepo.save(application);
    }
}
