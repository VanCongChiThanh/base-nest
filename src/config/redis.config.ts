import { registerAs } from '@nestjs/config';

/**
 * Redis configuration
 * Dùng để lưu refresh tokens
 */
export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
}));
