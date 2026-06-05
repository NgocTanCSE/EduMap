import { Controller, Post, Body, Get, HttpCode, HttpStatus, UseGuards, Request, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EnableTwoFactorAuthDto } from './dto/enable-2fa.dto';
import { VerifyTwoFactorAuthDto } from './dto/verify-2fa.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto'; // Import DTO
import { UpdatePreferencesDto } from './dtos/update-preferences.dto'; // Import DTO
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from './entities/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký người dùng mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(
      registerDto.email, 
      registerDto.password, 
      registerDto.full_name,
      registerDto.role
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu' })
  @ApiResponse({ status: 200, description: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi' })
  async requestPasswordReset(@Body() requestPasswordResetDto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(requestPasswordResetDto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng token' })
  @ApiResponse({ status: 200, description: 'Mật khẩu đã được đặt lại thành công' })
  @ApiResponse({ status: 401, description: 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin cá nhân đầy đủ' })
  async getProfile(@Request() req) {
    return this.authService.findUserById(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin hồ sơ' })
  async updateProfile(@Request() req, @Body() updateDto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, updateDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('preferences')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật cài đặt người dùng' })
  async updatePreferences(@Request() req, @Body() prefsDto: UpdatePreferencesDto) {
    return this.authService.updatePreferences(req.user.id, prefsDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/generate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo mã bí mật và mã QR cho xác thực 2 yếu tố (2FA)' })
  @ApiResponse({ status: 200, description: 'Mã bí mật và QR code 2FA đã được tạo' })
  async generateTwoFactorAuthSecret(@Request() req) {
    return this.authService.generateTwoFactorAuthSecret(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kích hoạt xác thực 2 yếu tố (2FA)' })
  @ApiResponse({ status: 200, description: '2FA đã được kích hoạt thành công' })
  @ApiResponse({ status: 401, description: 'Mã 2FA không hợp lệ' })
  async enableTwoFactorAuth(@Request() req, @Body() enableTwoFactorAuthDto: EnableTwoFactorAuthDto) {
    return this.authService.enableTwoFactorAuth(req.user.id, enableTwoFactorAuthDto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vô hiệu hóa xác thực 2 yếu tố (2FA)' })
  @ApiResponse({ status: 200, description: '2FA đã được vô hiệu hóa thành công' })
  @ApiResponse({ status: 401, description: 'Xác thực 2 yếu tố chưa được kích hoạt' })
  async disableTwoFactorAuth(@Request() req) {
    return this.authService.disableTwoFactorAuth(req.user.id);
  }

  @Post('2fa/verify')
  @ApiOperation({ summary: 'Xác minh mã 2 yếu tố (2FA) sau khi đăng nhập' })
  @ApiResponse({ status: 200, description: 'Mã 2FA hợp lệ, trả về token' })
  @ApiResponse({ status: 401, description: 'Mã 2FA không hợp lệ hoặc người dùng không tồn tại' })
  async verifyTwoFactorAuth(@Body() verifyTwoFactorAuthDto: VerifyTwoFactorAuthDto) {
    return this.authService.verifyTwoFactorAuthToken(verifyTwoFactorAuthDto.userId, verifyTwoFactorAuthDto.token);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Làm mới Access Token bằng Refresh Token' })
  @ApiResponse({ status: 200, description: 'Access Token và Refresh Token mới đã được cấp' })
  @ApiResponse({ status: 401, description: 'Refresh Token không hợp lệ' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens((refreshTokenDto as any).user_id || (refreshTokenDto as any).userId || '', refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin-only')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'API dành riêng cho Admin' })
  async adminOnly() {
    return { message: 'Chào Admin, đây là vùng dữ liệu nhạy cảm.' };
  }
}
