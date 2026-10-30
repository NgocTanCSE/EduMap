import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { RoleAssignmentService } from './role-assignment.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UserPreference } from './entities/user-preference.entity';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { DEV_USER_UUID, DEV_USER_EMAIL } from '../../common/constants/dev-user.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(UserPreference)
    private readonly preferenceRepo: Repository<UserPreference>,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly roleAssignmentService: RoleAssignmentService,
  ) {}

  /**
   * Đăng nhập người dùng bằng email và mật khẩu (Sử dụng bcrypt)
   */
  async login(email: string, password: string): Promise<any> {
    // Tìm user kèm theo password_hash (mặc định bị ẩn trong Entity)
    const user = await this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'password_hash', 'full_name', 'role'],
    });

    if (!user) {
      throw new UnauthorizedException('Thông tin đăng nhập không chính xác.');
    }

    // Kiểm tra mật khẩu (Bcrypt)
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Thông tin đăng nhập không chính xác.');
    }

    const tokens = await this.generateTokensForUser(user);

    return {
      userId: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
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
      role, // Native enum column (CA02) — được đọc trực tiếp từ DB, không map qua setter
      status: 'active',
      email_verified: false,
    };

    const newUser = this.userRepo.create(userPayload);
    const savedUser = await this.userRepo.save(newUser);

    // Auto-assign role based on email domain (e.g., .edu.vn → STUDENT).
    // This runs after the user is saved so roleAssignmentService can update it.
    await this.roleAssignmentService.checkEmailDomain(savedUser);

    const tokens = await this.generateTokensForUser(savedUser);

    return {
      userId: savedUser.id,
      email: savedUser.email,
      full_name: savedUser.full_name,
      role: savedUser.role,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      message: 'Đăng ký tài khoản thành công!',
    };
  }

  /**
   * Đăng nhập / Đăng ký tự động qua Google Account
   * Đồng bộ avatar, tên, email và gán vai trò (role) được chọn
   */
  async googleLogin(data: { email: string; full_name?: string; avatar_url?: string; role?: UserRole }): Promise<any> {
    const { email, full_name, avatar_url, role } = data;

    if (!email) {
      throw new BadRequestException('Email từ tài khoản Google là bắt buộc.');
    }

    let user = await this.userRepo.findOne({
      where: { email },
    });

    if (user) {
      // Đã có tài khoản: Cập nhật thông tin mới nhất từ Google
      let changed = false;
      if (full_name && user.full_name !== full_name) {
        user.full_name = full_name;
        changed = true;
      }
      if (avatar_url && user.avatar_url !== avatar_url) {
        user.avatar_url = avatar_url;
        changed = true;
      }
      if (role && user.role !== role) {
        user.role = role;
        changed = true;
      }
      user.last_login = new Date();
      if (changed) {
        await this.userRepo.save(user);
      }
    } else {
      // Người dùng mới: Tự động khởi tạo tài khoản với Google Profile
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(randomPassword, salt);

      const newUser = this.userRepo.create({
        email,
        full_name: full_name || email.split('@')[0],
        // Leave empty when Google does not return a photo. The frontend renders
        // a local gradient + initials avatar (no remote ui-avatars dependency).
        avatar_url: avatar_url || '',
        password_hash,
        role: role || UserRole.STUDENT,
        status: 'active',
        email_verified: true,
        last_login: new Date(),
      });

      user = await this.userRepo.save(newUser);
    }

    const tokens = await this.generateTokensForUser(user);

    return {
      userId: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      role: user.role,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      message: 'Đăng nhập Google thành công!',
    };
  }

  /** Dev-only helper: ensures a dev user exists in the database so that
   * `/api/auth/dev-login` (and every DB-backed endpoint that looks up the
   * user from the JWT `sub` claim) works on HF Spaces free tier where runtime
   * users created via Google login are wiped on container restart but the JWT
   * remains valid.
   *
   * Called by AuthController.devLogin(). Uses a deterministic UUID and email
   * so that:
   *   - the seeded row in edumap.db is found and returned (same UUID every
   *     time, stable across container restarts)
   *   - if the seeded row is missing (e.g. DB was modified), a new row is
   *     inserted with the same deterministic UUID — guaranteeing the JWT `sub`
   *     always matches the DB row.
   * Idempotent: repeated calls never create duplicate rows. */
  async createDevUser(): Promise<User> {
    // 1. Try by deterministic UUID first (fast path — seeded row exists)
    let user = await this.userRepo.findOne({ where: { id: DEV_USER_UUID } });
    if (user) return user;

    // 2. Try by email (older seeded rows may have a different UUID)
    user = await this.userRepo.findOne({ where: { email: DEV_USER_EMAIL } });
    if (user) return user;

    // 3. Create with the deterministic UUID so the JWT `sub` is always stable
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(randomPassword, salt);

    const newUser = this.userRepo.create({
      id: DEV_USER_UUID,
      email: DEV_USER_EMAIL,
      full_name: 'Dev User',
      avatar_url: '',
      password_hash,
      role: UserRole.STUDENT, // Student (native enum, CA02)
      status: 'active',
      email_verified: true,
      last_login: new Date(),
    });

    user = await this.userRepo.save(newUser);
    return user;
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
      this.resetTokenRepo.create({ user_id: user.id, token, expiresAt, isUsed: false })
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
    } catch (error: any) {
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
    await this.userRepo.update(resetToken.user_id, { password_hash });
    await this.resetTokenRepo.update(resetToken.id, { isUsed: true });
    return { success: true, message: 'Dat lai mat khau thanh cong!' };
  }

  async refreshToken(userId: string, refreshToken: string): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'full_name', 'role', 'refreshTokenHash'],
    });
    if (!user) {
      throw new UnauthorizedException('Nguoi dung khong ton tai.');
    }

    // Validate the provided refresh token against the stored hash.
    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token khong ton tai. Vui long dang nhap lai.');
    }
    const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Refresh token khong hop le. Vui long dang nhap lai.');
    }

    // Rotate: generate a new refresh token and invalidate the old one.
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, salt);
    await this.userRepo.update(userId, { refreshTokenHash: newRefreshTokenHash });

    const payload = { email: user.email, sub: user.id, role: user.role };
    const newToken = this.jwtService.sign(payload);
    return { access_token: newToken, refresh_token: newRefreshToken };
  }

  /** Generate, hash, and persist a refresh token for the given user. */
  private async generateAndSaveRefreshToken(userId: string): Promise<{ refreshToken: string }> {
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const refreshTokenHash = await bcrypt.hash(refreshToken, salt);
    await this.userRepo.update(userId, { refreshTokenHash });
    return { refreshToken };
  }

  /** Generate access + refresh tokens for a user. Used by login, register,
   * googleLogin, and 2FA verification after initial auth. */
  async generateTokensForUser(user: User): Promise<{ access_token: string; refresh_token: string }> {
    const payload = { email: user.email, sub: user.id, role: user.role };
    const access_token = this.jwtService.sign(payload);
    const { refreshToken } = await this.generateAndSaveRefreshToken(user.id);
    return { access_token, refresh_token: refreshToken };
  }

  /** Generate access + refresh tokens for a user by ID (used by 2FA verification). */
  async generateTokensForUserId(userId: string): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'role'],
    });
    if (!user) {
      throw new UnauthorizedException('Nguoi dung khong ton tai.');
    }
    return this.generateTokensForUser(user);
  }

  async getUserForTwoFactorVerification(userId: string) {
    return this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'isTwoFactorEnabled', 'twoFactorSecret'],
    });
  }

  /**
   * Lấy hồ sơ cá nhân của người dùng (không trả về password_hash / secret).
   * Ánh xạ theo bảng 6.2 — STT 29: auth.service.ts ↳ getProfile()
   */
  async getProfile(userId: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại.');
    }
    return {
      userId: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      avatar_url: user.avatar_url,
      phone: user.phone,
      bio: user.bio,
      date_of_birth: user.date_of_birth,
      major: user.major,
      mbti_type: user.mbti_type,
      skills: user.skills,
      interests: user.interests,
      points: user.points,
      level: user.level,
      status: user.status,
      email_verified: user.email_verified,
    };
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
    const allowedFields = ['full_name', 'avatar_url', 'phone', 'bio', 'date_of_birth', 'major', 'mbti_type', 'skills', 'interests'];
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
      date_of_birth: updatedUser.date_of_birth,
      major: updatedUser.major,
      mbti_type: updatedUser.mbti_type,
      skills: updatedUser.skills,
      interests: updatedUser.interests,
      points: updatedUser.points,
      level: updatedUser.level,
      access_token: this.jwtService.sign(payload),
      message: 'Cap nhat thong tin thanh cong!',
    };
  }

  /**
   * Cập nhật tù preferences (ngôn ngữ, theme, thông báo...) của người dùng
   */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Nguoi dung khong ton tai.');
    }

    let prefs = await this.preferenceRepo.findOne({ where: { user_id: userId } });
    if (!prefs) {
      prefs = this.preferenceRepo.create({ user_id: userId });
    }

    const allowed: (keyof UpdatePreferencesDto)[] = ['language', 'theme', 'notifications_enabled', 'privacy_level', 'notification_settings'];
    for (const field of allowed) {
      if (dto[field] !== undefined) {
        (prefs as any)[field] = dto[field];
      }
    }

    await this.preferenceRepo.save(prefs);
    return { ...prefs };
  }

  /**
   * Lấy cài đặt preferences của người dùng (ngôn ngữ, theme, thông báo...)
   */
  async getPreferences(userId: string): Promise<any> {
    let prefs = await this.preferenceRepo.findOne({ where: { user_id: userId } });
    if (!prefs) {
      // Tạo mặc định nếu chưa có
      prefs = this.preferenceRepo.create({
        user_id: userId,
        language: 'vi',
        theme: 'dark',
        notifications_enabled: true,
        privacy_level: 'public',
        notification_settings: JSON.stringify({ push: true, email: false, community: true, career: true }),
      });
      await this.preferenceRepo.save(prefs);
    }
    return { ...prefs };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<any> {
    const user = await this.userRepo.findOne({ 
      where: { id: userId },
      select: ['id', 'password_hash']
    });
    if (!user) {
      throw new NotFoundException('Nguoi dung khong ton tai.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Mat khau hien tai khong dung.');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(userId, { password_hash: hashedNewPassword });

    return { message: 'Doi mat khau thanh cong!' };
  }
}