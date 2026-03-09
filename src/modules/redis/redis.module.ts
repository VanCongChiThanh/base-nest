import { Global, Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import redisConfig from '../../config/redis.config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [redisConfig.KEY],
      useFactory: (redisConf: ConfigType<typeof redisConfig>): Redis => {
        return new Redis({
          host: redisConf.host,
          port: redisConf.port,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
