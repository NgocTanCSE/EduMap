import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from './entities/user.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UserPreference } from './entities/user-preference.entity';
import { RoleAssignmentService } from './role-assignment.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MfaService } from './mfa.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PasswordResetToken, UserPreference]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET, // No fallback, force environment variable
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [AuthService, RoleAssignmentService, JwtStrategy, MfaService],
  controllers: [AuthController],
  exports: [AuthService, RoleAssignmentService],
})
export class AuthModule {}
