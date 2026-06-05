import { Injectable, UnauthorizedException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { UserPreference } from './entities/user-preference.entity'; // Import UserPreference
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RoleAssignmentService } from './role-assignment.service';
import { MfaService } from './mfa.service';
import { v4 as uuid } from 'uuid';
import { UpdateProfileDto } from './dtos/update-profile.dto'; // Import DTO
import { UpdatePreferencesDto } from './dtos/update-preferences.dto'; // Import DTO

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(PasswordResetToken) private passwordResetTokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(UserPreference) private preferenceRepo: Repository<UserPreference>, // Inject Preference Repo
    private jwtService: JwtService,
    private roleAssignmentService: RoleAssignmentService,
    private mfaService: MfaService,
  ) {}

  /**
   * Đăng ký tài khoản mới
   */
  async register(email: string, password: string, fullName: string, role: UserRole = UserRole.STUDENT) {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = this.userRepo.create({
      email,
      password_hash: hashedPassword,
      full_name: fullName,
      role: role,
    });
    
    const savedUser = await this.userRepo.save(user);

    // Tự động gán quyền nâng cao nếu email thuộc domain giáo dục
    await this.roleAssignmentService.checkEmailDomain(savedUser);

    this.logger.log('New user registered:  ');
    return this.generateTokens(savedUser);
  }

  /**
   * Yêu cầu đặt lại mật khẩu: Tạo token và gửi email
   */
  async requestPasswordReset(email: string) {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      // Avoid revealing whether the email exists for security reasons
      this.logger.warn(`Password reset requested for non-existent email: ${email}`);
      return { message: 'Nếu email của bạn tồn tại trong hệ thống, chúng tôi đã gửi một liên kết đặt lại mật khẩu.' };
    }

    // Invalidate any existing tokens for this user
    await this.passwordResetTokenRepo.update(
      { userId: user.id, isUsed: false, expiresAt: MoreThan(new Date()) },
      { isUsed: true }
    );

    const token = uuid(); // Generate a unique token
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token valid for 1 hour

    const resetToken = this.passwordResetTokenRepo.create({
      token,
      expiresAt,
      userId: user.id,
    });
    await this.passwordResetTokenRepo.save(resetToken);

    // TODO: Send email with the reset link (e.g., https://yourfrontend.com/reset-password?token=YOUR_TOKEN)
    this.logger.log(`Password reset token generated for user ${user.id}. Token: ${token}`);

    return { message: 'Nếu email của bạn tồn tại trong hệ thống, chúng tôi đã gửi một liên kết đặt lại mật khẩu.' };
  }

  /**
   * Đặt lại mật khẩu bằng token
   */
  async resetPassword(token: string, newPassword: string) {
    const resetToken = await this.passwordResetTokenRepo.findOne({
      where: { token, isUsed: false, expiresAt: MoreThan(new Date()) },
      relations: ['user'], // Load the associated user
    });

    if (!resetToken || !resetToken.user) {
      throw new UnauthorizedException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }

    const user = resetToken.user;
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password_hash = hashedPassword;
    await this.userRepo.save(user);

    resetToken.isUsed = true; // Mark token as used
    await this.passwordResetTokenRepo.save(resetToken);

    this.logger.log(`Mật khẩu cho user ${user.id} đã được đặt lại.`);

    return { message: 'Mật khẩu của bạn đã được đặt lại thành công.' };
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
   * 🔐 Tạo mã bí mật và mã QR cho người dùng 2FA
   * Trả về: { secret: string, qrCodeUrl: string }
   */
  async generateTwoFactorAuthSecret(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');

    const { secret, qrCodeUrl } = await this.mfaService.generateSecret(user.email);

    // Lưu mã bí mật tạm thời vào người dùng
    user.twoFactorSecret = secret;
    await this.userRepo.save(user);

    this.logger.log(`Generated 2FA secret for user ${userId}`);
    return { secret, qrCodeUrl };
  }

  /**
   * 🛡️ Kích hoạt 2FA cho người dùng
   * Xác minh mã token và đặt isTwoFactorEnabled thành true
   */
  async enableTwoFactorAuth(userId: string, token: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');
    if (!user.twoFactorSecret) throw new UnauthorizedException('2FA secret chưa được tạo.');

    const isTokenValid = this.mfaService.verifyToken(token, user.twoFactorSecret);
    if (!isTokenValid) throw new UnauthorizedException('Mã 2FA không hợp lệ.');

    user.isTwoFactorEnabled = true;
    await this.userRepo.save(user);

    this.logger.log(`2FA enabled for user ${userId}`);
    return { message: 'Xác thực 2 yếu tố đã được kích hoạt thành công.' };
  }

  /**
   * ❌ Vô hiệu hóa 2FA cho người dùng
   * Xóa mã bí mật và đặt isTwoFactorEnabled thành false
   */
  async disableTwoFactorAuth(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');
    if (!user.isTwoFactorEnabled) throw new UnauthorizedException('Xác thực 2 yếu tố chưa được kích hoạt.');

    user.twoFactorSecret = null;
    user.isTwoFactorEnabled = false;
    await this.userRepo.save(user);

    this.logger.log(`2FA disabled for user ${userId}`);
    return { message: 'Xác thực 2 yếu tố đã được vô hiệu hóa thành công.' };
  }

  /**
   * ✅ Xác minh mã 2FA (được sử dụng trong quá trình đăng nhập hoặc các hoạt động nhạy cảm)
   */
  async verifyTwoFactorAuthToken(userId: string, token: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');
    // Ensure to select twoFactorSecret if not already selected due to select:false
    if (!user.isTwoFactorEnabled || !user.twoFactorSecret) throw new UnauthorizedException('Xác thực 2 yếu tố không được kích hoạt.');

    const isTokenValid = this.mfaService.verifyToken(token, user.twoFactorSecret);
    if (!isTokenValid) throw new UnauthorizedException('Mã 2FA không hợp lệ.');

    return await this.generateTokens(user); // If 2FA is verified, generate and return tokens
  }

  /**
   * Làm mới Access Token bằng Refresh Token
   */
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.userRepo.createQueryBuilder('user')
      .addSelect('user.refreshTokenHash') // Select the hashed refresh token
      .addSelect('user.isTwoFactorEnabled') // Need this for generateTokens
      .addSelect('user.twoFactorSecret') // Need this for generateTokens
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Người dùng không tồn tại hoặc refresh token không hợp lệ.');
    }

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Refresh token không hợp lệ.');
    }

    // Generate new tokens
    const newTokens = await this.generateTokens(user); // Await here to ensure user is saved with new refresh token hash

    this.logger.log(`Tokens refreshed for user ${userId}`);
    return newTokens;
  }

  /**
   * Đăng nhập
   */
  async login2(email: string, password: string) {
    const user = await this.userRepo.createQueryBuilder('user')
      .addSelect('user.password_hash')
      .addSelect('user.twoFactorSecret') // Select 2FA secret
      .addSelect('user.isTwoFactorEnabled') // Select 2FA enabled status
      .addSelect('user.refreshTokenHash') // Select refresh token hash for generateTokens
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    this.logger.log(`User logged in: ${user.email}`);

    if (user.isTwoFactorEnabled) {
      // If 2FA is enabled, return a flag indicating that 2FA verification is required
      // Client should then call a 2FA verification endpoint
      return { requiresTwoFactorAuth: true, userId: user.id, email: user.email };
    } else {
      // If 2FA is not enabled, directly generate tokens
      return {
        requiresTwoFactorAuth: false,
        ...(await this.generateTokens(user)), // Await here as generateTokens now saves user
      };
    }
  }

  /**
   * Tạo JWT Tokens
   */
  private async generateTokens(user: User) { // Make it async
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refresh_token = this.jwtService.sign(payload, { expiresIn: '7d' }); // Generate new refresh token

    // Hash the refresh token and save it to the user
    user.refreshTokenHash = await bcrypt.hash(refresh_token, 10); // Use a salt round like 10
    await this.userRepo.save(user); // Save the user with the new hashed refresh token
return {
  access_token,
  refresh_token,
  user: {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
  },
};
}

// --- Profile Management ---

async findUserById(userId: string) {
const user = await this.userRepo.findOne({
  where: { id: userId },
  relations: ['preferences'],
});
if (!user) throw new NotFoundException('Người dùng không tồn tại');
return user;
}

async updateProfile(userId: string, updateDto: UpdateProfileDto) {
const user = await this.findUserById(userId);
Object.assign(user, updateDto);
return this.userRepo.save(user);
}

async updatePreferences(userId: string, prefsDto: UpdatePreferencesDto) {
let prefs = await this.preferenceRepo.findOne({ where: { user_id: userId } });

if (!prefs) {
  prefs = this.preferenceRepo.create({ ...prefsDto, user_id: userId });
} else {
  Object.assign(prefs, prefsDto);
}

return this.preferenceRepo.save(prefs);
}
}

