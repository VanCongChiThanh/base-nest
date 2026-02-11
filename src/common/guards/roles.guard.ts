import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators';
import { Role } from '../enums';

/**
 * Role-based Authorization Guard
 * Check user roles với required roles được định nghĩa bởi @Roles() decorator
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lấy required roles từ metadata
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Nếu không có @Roles() decorator, cho phép truy cập
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Nếu không có user (chưa authenticate), từ chối
    if (!user) {
      return false;
    }

    // Check xem user có ít nhất 1 role trong required roles không
    return requiredRoles.some((role) => user.role === role);
  }
}
