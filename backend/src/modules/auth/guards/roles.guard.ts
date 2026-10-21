import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../auth/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
    const hasRole = isSuperAdmin || requiredRoles.some((role) => user?.role === role);
    
    if (!hasRole) {
      throw new ForbiddenException('Bạn cần quyền để thực hiện hành động này.');
    }

    return true;
  }
}
