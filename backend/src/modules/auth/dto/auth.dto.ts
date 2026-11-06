import { IsString, IsNotEmpty } from 'class-validator';
export class AuthDto {
    @IsString()
    @IsNotEmpty()
    username: string;
    @IsString()
    @IsNotEmpty()
    password: string;
}
