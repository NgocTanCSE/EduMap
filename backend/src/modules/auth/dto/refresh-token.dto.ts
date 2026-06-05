import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token để lấy access token mới' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
