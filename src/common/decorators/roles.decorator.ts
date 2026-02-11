import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums';

export const ROLES_KEY = 'roles';

/**
 * Decorator for specifying roles allowed to access a route
 * @example @Roles(Role.ADMIN) - Only Admin can access
 * @example @Roles(Role.ADMIN, Role.USER) - Admin and User can access
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
