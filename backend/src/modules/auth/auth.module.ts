import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '@nestjs-modules/mailer';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MfaService } from './mfa.service';
import { RoleAssignmentService } from './role-assignment.service';
import { User } from './entities/user.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UserPreference } from './entities/user-preference.entity';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PasswordResetToken, UserPreference]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET
        ? process.env.JWT_SECRET
        : process.env.NODE_ENV === 'production'
          ? (() => { throw new Error('JWT_SECRET environment variable is required in production.'); })()
          : 'edumap-default-secret-key-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
    MailerModule,
  ],
  providers: [AuthService, MfaService, JwtStrategy, RoleAssignmentService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, PassportModule, MfaService, RoleAssignmentService],
})
export class AuthModule {}

