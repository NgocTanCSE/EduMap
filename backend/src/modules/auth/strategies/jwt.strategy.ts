import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production. Set it via your deployment configuration.');
  }
  return secret || 'edumap-default-secret-key-change-in-production';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: any) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
