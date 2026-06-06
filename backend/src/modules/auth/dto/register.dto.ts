import { IsString, IsNotEmpty, IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(UserRole)
  role: UserRole;
}
