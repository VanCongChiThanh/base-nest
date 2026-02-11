import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to get the current user from the request
 * @example @CurrentUser() user: User - Get entire user object
 * @example @CurrentUser('id') userId: string - Get only user id
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
