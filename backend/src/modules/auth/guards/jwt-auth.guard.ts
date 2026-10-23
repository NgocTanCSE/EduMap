import { Injectable, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      let message = 'Bạn cần đăng nhập để thực hiện chức năng này.';
      if (info?.name === 'TokenExpiredError') {
        message = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      } else if (info?.name === 'JsonWebTokenError') {
        message = 'Token không hợp lệ. Vui lòng đăng nhập lại.';
      } else if (info?.name === 'NotBeforeError') {
        message = 'Token chưa có hiệu lực.';
      }
      throw err || new UnauthorizedException(message);
    }
    return user;
  }
}
