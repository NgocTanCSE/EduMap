import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnableTwoFactorAuthDto {
  @ApiProperty({ description: 'Mã xác thực 2 yếu tố từ ứng dụng xác thực' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
