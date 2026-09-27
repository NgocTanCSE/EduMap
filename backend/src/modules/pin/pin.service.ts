import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pin, PinType, PinStatus } from './entities/pin.entity';
import { CreatePinDto } from './dto/create-pin.dto';
import { UpdatePinDto } from './dto/update-pin.dto';
import { User } from '../auth/entities/user.entity';

export interface FindPinQuery {
  type?: PinType;
  status?: PinStatus;
  my?: boolean;
  userId?: string;
  bbox?: string; // "w,s,e,n"
  limit?: number;
  offset?: number;
}

@Injectable()
export class PinService {
  constructor(
    @InjectRepository(Pin) private pinRepo: Repository<Pin>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  /** Lấy tên người post từ user ID (mặc định 'Ẩn danh' nếu user đã xóa). */
  private async resolvePosterName(userId: string): Promise<string> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return user?.full_name || 'Ẩn danh';
  }

  async create(userId: string, dto: CreatePinDto): Promise<Pin> {
    const pin = this.pinRepo.create({
      ...dto,
      posted_by: userId,
      poster_name: await this.resolvePosterName(userId),
      status: PinStatus.PENDING, // chờ admin duyệt trước khi hiện trên bản đồ
      location: dto.location || null,
    });
    return this.pinRepo.save(pin);
  }

  async findAll(query: FindPinQuery): Promise<Pin[]> {
    const { type, status, my, userId, bbox, limit = 100, offset = 0 } = query;
    const qb = this.pinRepo
      .createQueryBuilder('pin')
      .where('pin.deleted_at IS NULL');

    if (my && userId) {
      // "Của tôi": lấy tất cả pin mình đã đăng (kể cả pending).
      qb.andWhere('pin.posted_by = :uid', { uid: userId });
    } else {
      // Công khai chỉ thấy pin đã được duyệt.
      qb.andWhere('pin.status = :status', { status: status || PinStatus.PUBLISHED });
    }

    if (type) qb.andWhere('pin.type = :type', { type });
    if (bbox) {
      const [w, s, e, n] = String(bbox)
        .split(',')
        .map((v) => Number(v));
      qb.andWhere(
        'ST_Intersects(pin.location, ST_MakeEnvelope(:w, :s, :e, :n, 4326))',
        { w, s, e, n },
      );
    }

    return qb
      .orderBy('pin.created_at', 'DESC')
      .offset(offset)
      .limit(limit)
      .getMany();
  }

  async findOne(id: string, userId?: string, isAdmin = false): Promise<Pin> {
    const pin = await this.pinRepo.findOne({ where: { id } });
    if (!pin) throw new NotFoundException('Pin not found');
    // Pin pending/rejected chỉ thấy bởi chủ sở hữu hoặc admin.
    if (pin.status !== PinStatus.PUBLISHED && pin.posted_by !== userId && !isAdmin) {
      throw new NotFoundException('Pin not found');
    }
    return pin;
  }

  async update(id: string, dto: UpdatePinDto, userId: string, isAdmin = false): Promise<Pin> {
    const pin = await this.pinRepo.findOne({ where: { id } });
    if (!pin) throw new NotFoundException('Pin not found');
    if (pin.posted_by !== userId && !isAdmin) {
      throw new ForbiddenException('Chỉ chủ sở hữu hoặc admin mới được sửa');
    }
    Object.assign(pin, dto);
    return this.pinRepo.save(pin);
  }

  async remove(id: string, userId: string, isAdmin = false): Promise<void> {
    const pin = await this.pinRepo.findOne({ where: { id } });
    if (!pin) throw new NotFoundException('Pin not found');
    if (pin.posted_by !== userId && !isAdmin) {
      throw new ForbiddenException('Chỉ chủ sở hữu hoặc admin mới được xóa');
    }
    await this.pinRepo.softDelete(id);
  }

  /** Dành cho admin: duyệt/ghi chú trạng thái một pin. */
  async setStatus(id: string, status: PinStatus): Promise<Pin> {
    const pin = await this.pinRepo.findOne({ where: { id } });
    if (!pin) throw new NotFoundException('Pin not found');
    pin.status = status;
    return this.pinRepo.save(pin);
  }
}
