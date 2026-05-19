import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { RoleAssignmentService } from './role-assignment.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private roleAssignmentService: RoleAssignmentService,
  ) {}

  /**
   * Đăng ký tài khoản mới
   */
  async register(email: string, password: string, fullName: string) {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = this.userRepo.create({
      email,
      password_hash: hashedPassword,
      full_name: fullName,
      role: UserRole.STUDENT, // Mặc định là Student
    });
    
    const savedUser = await this.userRepo.save(user);

    // Tự động gán quyền nâng cao nếu email thuộc domain giáo dục
    await this.roleAssignmentService.checkEmailDomain(savedUser);

    this.logger.log('New user registered:  ');
    return this.generateTokens(savedUser);
  }

  /**
   * Đăng nhập
   */
  async login(email: string, password: string) {
    const user = await this.userRepo.createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    this.logger.log('User logged in:  ');
    return this.generateTokens(user);
  }

  /**
   * Lấy thông tin cá nhân
   */
  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');
    return user;
  }

  /**
   * Tạo JWT Tokens
   */
  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '1h' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    };
  }
}
