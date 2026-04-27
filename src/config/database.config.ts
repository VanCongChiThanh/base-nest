import { registerAs } from '@nestjs/config';

const isProduction = process.env.NODE_ENV === 'production';

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  if (isProduction && fallback === undefined) {
    throw new Error(`[database.config] Missing required env: ${name}`);
  }
  return fallback ?? '';
}

/**
 * Database configuration
 * Sử dụng registerAs để group config theo namespace
 */
export default registerAs('database', () => ({
  type: 'postgres' as const,
  host: getEnv('DB_HOST', 'localhost'),
  port: parseInt(getEnv('DB_PORT', '5432'), 10),
  username: getEnv('DB_USERNAME', 'postgres'),
  password: getEnv('DB_PASSWORD'),
  database: getEnv('DB_DATABASE', 'nestjs_base'),
  entities: ['dist/**/*.entity{.ts,.js}'],
  synchronize: true,
  logging: false,
}));
