import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../auth/entities/audit-log.entity';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  async log(data: {
    user: User;
    action: string;
    resource: string;
    resource_id?: string;
    old_data?: any;
    new_data?: any;
    ip_address?: string;
  }) {
    const logEntry = this.auditLogRepo.create(data);
    return this.auditLogRepo.save(logEntry);
  }

  async findAll(query: AuditLogQueryDto) {
    const { page = 1, limit = 10, userId, action, resource } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.auditLogRepo.createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (userId) {
      queryBuilder.andWhere('user.id = :userId', { userId });
    }

    if (action) {
      queryBuilder.andWhere('log.action = :action', { action });
    }

    if (resource) {
      queryBuilder.andWhere('log.resource = :resource', { resource });
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
}
