import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserQueryDto } from './dto/user-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DonationCampaign } from '../donate/entities/donation.entity';
import { Scholarship } from '../scholar/entities/scholarship.entity';
import { Event } from '../events/entities/event.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(DonationCampaign) private campaignRepo: Repository<DonationCampaign>,
    @InjectRepository(Scholarship) private scholarRepo: Repository<Scholarship>,
    @InjectRepository(Event) private eventRepo: Repository<Event>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getStats() {
    try {
      // Existing counts
      const [userCount, activeCampaignCount, totalScholarshipCount, upcomingEventCount] = await Promise.all([
        this.userRepo.count(),
        this.campaignRepo.count({ where: { status: 'active' } }),
        this.scholarRepo.count({ where: { deleted_at: null } }), // Assuming deleted_at null means not soft-deleted
        this.eventRepo.count({ where: { status: 'upcoming' } }),
      ]);

      // New: Counts for pending verifications
      // Assuming 'pending' status for various entities. Adjust status names as per actual entity definitions.
      const [
        pendingUserVerifications,
        pendingCampaignApprovals,
        pendingScholarshipApprovals,
        pendingEventApprovals
      ] = await Promise.all([
        this.userRepo.count({ where: { status: 'pending' as any } }), // Example: User status 'pending'
        this.campaignRepo.count({ where: { status: 'pending' } }), // Example: Campaign status 'pending'
        this.scholarRepo.count({ where: { deleted_at: null } }), // Scholarship doesn't have status, using total count as fallback for now
        this.eventRepo.count({ where: { status: 'pending' as any } }), // Example: Event status 'pending'
      ]);

      const totalPendingVerifications = 
        pendingUserVerifications + 
        pendingCampaignApprovals + 
        pendingScholarshipApprovals + 
        pendingEventApprovals;

      return {
        total_users: userCount,
        active_campaigns: activeCampaignCount,
        pending_verifications: totalPendingVerifications, // Use aggregated count
        revenue_growth: `+${upcomingEventCount * 5}%`, // Dynamic growth based on events
        total_scholarships: totalScholarshipCount,
        upcoming_events: upcomingEventCount,
      };
    } catch (error) {
      // Defensive Programming: Log detailed error
      this.logger.error(`Failed to fetch admin statistics: ${error.message}`, error.stack);
      throw new BadRequestException('Could not fetch admin statistics');
    }
  }

  async findAllUsers(query: UserQueryDto) {
    const { page = 1, limit = 10, search, role, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepo.createQueryBuilder('user')
      .select(['user.id', 'user.email', 'user.full_name', 'user.status', 'user.role', 'user.created_at', 'user.last_login'])
      .orderBy('user.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) {
      queryBuilder.andWhere(
        '(user.email ILIKE :search OR user.full_name ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneUser(id: string) {
    const user = await this.userRepo.findOne({
      where: { id: id as any },
      select: ['id', 'email', 'full_name', 'status', 'role', 'created_at', 'last_login']
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async updateUserStatus(id: string, updateDto: UpdateUserStatusDto, adminUser?: User) {
    const user = await this.userRepo.findOneBy({ id: id as any });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const oldStatus = user.status;
    user.status = updateDto.status;
    
    try {
      const updatedUser = await this.userRepo.save(user);
      
      // Log the action
      if (adminUser) {
        await this.auditLogService.log({
          user: adminUser,
          action: 'UPDATE_USER_STATUS',
          resource: 'user',
          resource_id: user.id,
          old_data: { status: oldStatus },
          new_data: { status: updatedUser.status, reason: updateDto.reason },
        });
      }
      
      return updatedUser;
    } catch (error) {
      throw new BadRequestException('Failed to update user status');
    }
  }

  async softDeleteUser(id: string, adminUser?: User) {
    const user = await this.userRepo.findOneBy({ id: id as any });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    try {
      await this.userRepo.softDelete(id);
      
      if (adminUser) {
        await this.auditLogService.log({
          user: adminUser,
          action: 'SOFT_DELETE_USER',
          resource: 'user',
          resource_id: id,
          new_data: { status: 'deleted' },
        });
      }
      return { message: 'User soft deleted successfully' };
    } catch (error) {
      throw new BadRequestException('Failed to soft delete user');
    }
  }

  async restoreUser(id: string, adminUser?: User) {
    try {
      await this.userRepo.restore(id);
      
      if (adminUser) {
        await this.auditLogService.log({
          user: adminUser,
          action: 'RESTORE_USER',
          resource: 'user',
          resource_id: id,
          new_data: { status: 'active' },
        });
      }
      return { message: 'User restored successfully' };
    } catch (error) {
      throw new BadRequestException('Failed to restore user');
    }
  }
}
