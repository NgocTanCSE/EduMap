import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    errorCode?: string,
  ) {
    super(
      {
        message,
        error: 'Business Error',
        statusCode: status,
        errorCode,
      },
      status,
    );
  }
}

export class NotFoundException extends BusinessException {
  constructor(entity: string, identifier?: string | number) {
    const message = identifier
      ? `${entity} with identifier '${identifier}' not found`
      : `${entity} not found`;
    super(message, HttpStatus.NOT_FOUND, 'NOT_FOUND');
  }
}

export class DuplicateException extends BusinessException {
  constructor(entity: string, field: string, value: string | number) {
    super(
      `${entity} with ${field} '${value}' already exists`,
      HttpStatus.CONFLICT,
      'DUPLICATE_ENTRY',
    );
  }
}

export class ValidationException extends BusinessException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedException extends BusinessException {
  constructor(message: string = 'Unauthorized access') {
    super(message, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

export class ForbiddenException extends BusinessException {
  constructor(message: string = 'Access denied') {
    super(message, HttpStatus.FORBIDDEN, 'FORBIDDEN');
  }
}

export class RateLimitException extends BusinessException {
  constructor(message: string = 'Too many requests') {
    super(message, HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT');
  }
}
