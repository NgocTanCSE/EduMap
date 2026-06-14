import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Đăng nhập người dùng bằng email và mật khẩu (Sử dụng bcrypt)
   */
  async login(email: string, password: string): Promise<any> {
    // Tìm user kèm theo password_hash (mặc định bị ẩn trong Entity)
    const user = await this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'password_hash', 'full_name', 'role_id'],
    });

    if (!user) {
      throw new UnauthorizedException('Thông tin đăng nhập không chính xác.');
    }

    // Kiểm tra mật khẩu (Bcrypt)
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Thông tin đăng nhập không chính xác.');
    }

    // Tạo JWT Payload
    const payload = { 
      email: user.email, 
      sub: user.id, 
      role: user.role 
    };

    return {
      userId: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      access_token: this.jwtService.sign(payload),
      message: 'Đăng nhập thành công!',
    };
  }

  /**
   * Đăng ký người dùng mới
   */
  async register(email: string, password: string, full_name: string, role: UserRole): Promise<any> {
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email này đã được sử dụng.');
    }

    // Hash mật khẩu
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Tạo user mới (Ép kiểu DeepPartial<User> để đảm bảo match đúng overload)
    const userPayload: DeepPartial<User> = {
      email,
      password_hash,
      full_name,
      role, // Tự động map role_id qua setter của Entity
      status: 'active',
      email_verified: false,
    };

    const newUser = this.userRepo.create(userPayload);
    const savedUser = await this.userRepo.save(newUser);

    // Tạo token cho user mới đăng ký luôn
    const payload = { 
        email: savedUser.email, 
        sub: savedUser.id, 
        role: savedUser.role 
    };

    return {
      userId: savedUser.id,
      email: savedUser.email,
      full_name: savedUser.full_name,
      role: savedUser.role,
      access_token: this.jwtService.sign(payload),
      message: 'Đăng ký tài khoản thành công!',
    };
  }
}
