import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { INestApplication, Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(app: INestApplication) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    try {
      const pubClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        // redis v4 `connect()` never resolves/rejects when the target is refused:
        // it keeps retrying and emits 'error' forever, which would hang bootstrap.
        // `reconnectStrategy: () => null` stops retrying so the promise rejects,
        // and the timeout race is a belt-and-suspenders guard for any stuck socket.
        socket: { reconnectStrategy: () => null, connectTimeout: 4000 },
      });
      const subClient = pubClient.duplicate();

      const connectTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timed out')), 5000),
      );
      await Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        connectTimeout,
      ]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Successfully connected to Redis for Socket.IO Adapter');
    } catch (error) {
      this.logger.warn(`Failed to connect to Redis for Socket.IO Adapter: ${(error as Error).message}. Falling back to in-memory adapter.`);
      // If Redis connection fails, we don't set this.adapterConstructor, so it will fall back to default
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
