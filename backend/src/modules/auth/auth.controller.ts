import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';
import { Public } from 'src/common/decorators/public.decorator'; // Assuming this decorator exists

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public() // Mark as public, no auth required for login/register
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() authDto: AuthDto) {
    try {
      const result = await this.authService.login(authDto.username, authDto.password);
      return { success: true, data: result };
    } catch (error) {
      // Defensive Programming: Catch specific error types or log for debugging
      console.error(`Login failed for user ${authDto.username}: ${error.message}`);
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async register(@Body() authDto: AuthDto) {
    try {
      const result = await this.authService.register(authDto.username, authDto.password);
      return { success: true, data: result };
    } catch (error) {
      // Defensive Programming: Catch specific error types or log for debugging
      console.error(`Registration failed for user ${authDto.username}: ${error.message}`);
      throw new BadRequestException('Registration failed');
    }
  }
}
