import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
@Injectable()
export class RoleAssignmentService {
    private readonly logger = new Logger(RoleAssignmentService.name);
    constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>) { }
    async checkEmailDomain(user: User) {
        if (user.email.endsWith('.edu.vn')) {
            this.logger.log(`Auto-assigning STUDENT role to ${user.email}`);
            user.role = UserRole.STUDENT;
            return this.userRepo.save(user);
        }
    }
    async promoteToDonor(userId: string) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (user && user.role !== UserRole.ADMIN) {
            this.logger.log(`Promoting user ${userId} to DONOR role`);
            user.role = UserRole.DONOR;
            return this.userRepo.save(user);
        }
    }
    async promoteToMentor(userId: string) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (user) {
            this.logger.log(`Promoting user ${userId} to MENTOR role`);
            user.role = UserRole.MENTOR;
            return this.userRepo.save(user);
        }
    }
}
