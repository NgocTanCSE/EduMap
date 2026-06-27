import { Controller, Post, Patch, Get, Body, HttpCode, HttpStatus, UseGuards, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      // Assuming AuthService.login expects email and password now
      const result = await this.authService.login(loginDto.email, loginDto.password);
      return { success: true, data: result };
    } catch (error) {
      console.error(`Login failed for user ${loginDto.email}: ${error.message}`);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    try {
      // Assuming AuthService.register expects email, password, full_name, role now
      const result = await this.authService.register(registerDto.email, registerDto.password, registerDto.full_name, registerDto.role);
      return { success: true, data: result };
    } catch (error) {
      console.error(`Registration failed for user ${registerDto.email}: ${error.message}`);
      throw new BadRequestException('Registration failed');
    }
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: RequestPasswordResetDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('2fa/verify')
  async verifyTwoFactor(@Body() body: { userId?: string; token?: string }) {
    if (!body.userId || !body.token) {
      throw new BadRequestException('userId và token là bắt buộc');
    }

    const user = await this.authService.getUserForTwoFactorVerification(body.userId);
    if (!user?.isTwoFactorEnabled) {
      return { success: true, data: { message: '2FA chưa được bật cho tài khoản này.' } };
    }

    const isValid = await this.authService.validatePassword(body.token, user.twoFactorSecret || '', true);
    if (!isValid) {
      throw new UnauthorizedException('Mã 2FA không hợp lệ');
    }

    const result = await this.authService.refreshToken(body.userId);
    return { success: true, data: result };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() body: { refreshToken?: string; userId?: string }) {
    if (!body.refreshToken || !body.userId) {
      throw new BadRequestException('refreshToken và userId là bắt buộc');
    }
    const result = await this.authService.refreshToken(body.userId);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Get('me')
  async getProfile(@Req() req: any) {
    return { success: true, data: { userId: req.user.id || req.user.sub, email: req.user.email } };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const userId = req.user.id || req.user.sub;
    const result = await this.authService.updateProfile(userId, dto);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    const userId = req.user.id || req.user.sub;
    const result = await this.authService.changePassword(userId, body.currentPassword, body.newPassword);
    return { success: true, data: result };
  }
}
