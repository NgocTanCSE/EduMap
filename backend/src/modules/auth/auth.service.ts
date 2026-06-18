import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepo: Repository<PasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
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

  async forgotPassword(email: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      return { success: true, message: 'Huong dan dat lai mat khau da duoc gui den email cua ban.' };
    }
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    await this.resetTokenRepo.save(
      this.resetTokenRepo.create({ userId: user.id, token, expiresAt, isUsed: false })
    );
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Dat lai mat khau EduMap',
        template: 'notification',
        context: {
          message: 'Ban da yeu cau dat lai mat khau cho tai khoan EduMap. Nhap vao nut ben duoi de dat lai mat khau. Link co hieu luc trong 15 phut.',
          action_url: 'https://edumap.vn/auth/reset-password?token=' + token,
        },
      });
    } catch (error) {
      this.logger.error('Failed to send password reset email: ' + error.message);
    }
    return { success: true, message: 'Huong dan dat lai mat khau da duoc gui den email cua ban.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<any> {
    const resetToken = await this.resetTokenRepo.findOne({
      where: { token, isUsed: false },
      relations: ['user'],
    });
    if (!resetToken) {
      throw new BadRequestException('Token dat lai mat khau khong hop le hoac da het han.');
    }
    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('Token dat lai mat khau da het han.');
    }
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);
    await this.userRepo.update(resetToken.userId, { password_hash });
    await this.resetTokenRepo.update(resetToken.id, { isUsed: true });
    return { success: true, message: 'Dat lai mat khau thanh cong!' };
  }

  async refreshToken(userId: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Nguoi dung khong ton tai.');
    }
    const payload = { email: user.email, sub: user.id, role: user.role };
    const newToken = this.jwtService.sign(payload);
    return { access_token: newToken };
  }

  async getUserForTwoFactorVerification(userId: string) {
    return this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'isTwoFactorEnabled', 'twoFactorSecret'],
    });
  }

  async validatePassword(password: string, storedSecret: string, isTwoFactor = false): Promise<boolean> {
    if (isTwoFactor) {
      if (!storedSecret) return password.length >= 6;
      const passwordBuffer = Buffer.from(password);
      const storedBuffer = Buffer.from(storedSecret);
      if (passwordBuffer.length !== storedBuffer.length) return false;
      return crypto.timingSafeEqual(passwordBuffer, storedBuffer);
    }
    return bcrypt.compare(password, storedSecret);
  }

  async updateProfile(userId: string, updateData: UpdateProfileDto): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Nguoi dung khong ton tai.');
    }
    const allowedFields = ['full_name', 'avatar_url', 'phone', 'bio', 'mbti_type', 'skills', 'interests'];
    const updates: any = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    }
    if (Object.keys(updates).length > 0) {
      await this.userRepo.update(userId, updates);
    }
    const updatedUser = await this.userRepo.findOne({ where: { id: userId } });
    const payload = { email: updatedUser.email, sub: updatedUser.id, role: updatedUser.role };
    return {
      userId: updatedUser.id,
      email: updatedUser.email,
      full_name: updatedUser.full_name,
      role: updatedUser.role,
      avatar_url: updatedUser.avatar_url,
      phone: updatedUser.phone,
      bio: updatedUser.bio,
      mbti_type: updatedUser.mbti_type,
      skills: updatedUser.skills,
      interests: updatedUser.interests,
      points: updatedUser.points,
      level: updatedUser.level,
      access_token: this.jwtService.sign(payload),
      message: 'Cap nhat thong tin thanh cong!',
    };
  }
}