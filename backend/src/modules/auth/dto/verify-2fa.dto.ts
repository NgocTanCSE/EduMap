import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyTwoFactorAuthDto {
  @ApiProperty({ description: 'ID của người dùng cần xác thực 2 yếu tố' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Mã xác thực 2 yếu tố từ ứng dụng xác thực' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
