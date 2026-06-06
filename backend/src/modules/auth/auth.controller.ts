import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from 'src/common/decorators/public.decorator';

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
  async forgotPassword(@Body('email') email: string) {
    console.log(`Password reset requested for email: ${email}`);
    return { success: true, message: 'Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.' };
  }
}
