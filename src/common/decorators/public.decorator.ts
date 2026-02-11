import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator for marking endpoints as public (no authentication required)
 * @example @Public() in controller method
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
