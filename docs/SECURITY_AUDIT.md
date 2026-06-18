# EduMap Security Audit Guide

## Tổng quan

Hướng dẫn kiểm tra bảo mật cho EduMap application.

## 1. SQL Injection Prevention

### 1.1 TypeORM Parameterized Queries

```typescript
// GOOD: Parameterized queries
const user = await this.userRepo
  .createQueryBuilder('user')
  .where('user.email = :email', { email: userEmail })
  .getOne();

// BAD: String concatenation (NEVER DO THIS)
const query = `SELECT * FROM users WHERE email = '${userEmail}'`;
```

### 1.2 Input Validation

```typescript
// backend/src/modules/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsString()
  @MaxLength(255)
  full_name: string;
}
```

## 2. XSS Prevention

### 2.1 React Auto-Escaping

```tsx
// React automatically escapes content
function UserPost({ content }: { content: string }) {
  return <div>{content}</div>; // Safe - content is escaped
}

// DANGEROUS: Don't use dangerouslySetInnerHTML with user input
function DangerousPost({ content }: { content: string }) {
  return <div dangerouslySetInnerHTML={{ __html: content }} />; // UNSAFE
}
```

### 2.2 Content Security Policy

```typescript
// backend/src/main.ts
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));
}
```

## 3. CSRF Protection

### 3.1 CSRF Token Implementation

```typescript
// backend/src/common/guards/csrf.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Check for CSRF token in headers
    const token = request.headers['x-csrf-token'];
    const sessionToken = request.session?.csrfToken;
    
    return token === sessionToken;
  }
}
```

### 3.2 SameSite Cookies

```typescript
// backend/src/main.ts
app.use(cookieParser());
app.use(session({
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  },
}));
```

## 4. Authentication Security

### 4.1 Password Hashing

```typescript
// backend/src/modules/auth/auth.service.ts
import * as bcrypt from 'bcrypt';

async hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

async validatePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### 4.2 JWT Security

```typescript
// backend/src/modules/auth/strategies/jwt.strategy.ts
import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';

export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email };
  }
}
```

### 4.3 Rate Limiting

```typescript
// backend/src/common/guards/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  constructor() {
    super({
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    });
  }
}
```

## 5. API Security

### 5.1 Input Sanitization

```typescript
// backend/src/common/pipes/sanitize.pipe.ts
import { PipeTransform, Injectable } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any) {
    if (typeof value === 'string') {
      return sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
      });
    }
    return value;
  }
}
```

### 5.2 CORS Configuration

```typescript
// backend/src/main.ts
app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
```

## 6. File Upload Security

### 6.1 File Type Validation

```typescript
// backend/src/common/pipes/file-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
  ];

  transform(file: Express.Multer.File) {
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large');
    }

    return file;
  }
}
```

### 6.2 Secure File Storage

```typescript
// backend/src/modules/storage/storage.service.ts
async uploadFile(file: Express.Multer.File, userId: string) {
  // Generate unique filename
  const filename = `${uuid()}-${file.originalname}`;
  
  // Store in secure location
  const filepath = path.join(__dirname, '../../uploads', filename);
  
  // Write file
  await fs.writeFile(filepath, file.buffer);
  
  return { filename, filepath };
}
```

## 7. Environment Security

### 7.1 Secrets Management

```bash
# .env.example - Never commit actual .env files
DATABASE_URL=postgresql://user:password@localhost:5432/db
JWT_SECRET=your-secret-key-here
GEMINI_API_KEY=your-api-key-here
```

### 7.2 Environment Variable Validation

```typescript
// backend/src/config/env.validation.ts
import { plainToClass } from 'class-transformer';
import { IsString, IsNumber, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsNumber()
  PORT: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
```

## 8. Logging and Monitoring

### 8.1 Security Logging

```typescript
// backend/src/common/interceptors/security-logging.interceptor.ts
@Injectable()
export class SecurityLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Log security-relevant events
    if (this.isSecurityRelevant(request)) {
      console.log({
        timestamp: new Date().toISOString(),
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        method: request.method,
        path: request.path,
        userId: request.user?.id,
      });
    }

    return next.handle();
  }

  private isSecurityRelevant(request: Request): boolean {
    const securityPaths = ['/auth', '/admin', '/api/upload'];
    return securityPaths.some(path => request.path.startsWith(path));
  }
}
```

## 9. Security Checklist

### Authentication
- [ ] Passwords hashed with bcrypt (salt rounds >= 12)
- [ ] JWT tokens have expiration
- [ ] Refresh tokens are rotated
- [ ] Account lockout after failed attempts
- [ ] Two-factor authentication available

### Authorization
- [ ] Role-based access control implemented
- [ ] API endpoints protected with guards
- [ ] Users can only access their own resources
- [ ] Admin routes restricted

### Input Validation
- [ ] All user input validated with class-validator
- [ ] SQL queries use parameterized queries
- [ ] File uploads validated (type, size)
- [ ] HTML sanitized before rendering

### API Security
- [ ] CORS configured properly
- [ ] Rate limiting implemented
- [ ] Request size limits enforced
- [ ] API keys rotated regularly

### Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] HTTPS enforced
- [ ] Secrets stored in environment variables
- [ ] Database backups encrypted

### Monitoring
- [ ] Security events logged
- [ ] Failed login attempts monitored
- [ ] Unusual activity alerts
- [ ] Regular security audits scheduled

## 10. Incident Response

### 10.1 Security Incident Steps

1. **Identify**: Detect and confirm the security incident
2. **Contain**: Limit the damage and prevent further access
3. **Eradicate**: Remove the threat from the system
4. **Recover**: Restore systems to normal operation
5. **Learn**: Document the incident and improve defenses

### 10.2 Contact Information

- Security Team: security@edumap.vn
- Emergency: +84 xxx xxx xxx
