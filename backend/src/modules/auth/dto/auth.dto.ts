// backend/src/modules/auth/dto/auth.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class AuthDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
