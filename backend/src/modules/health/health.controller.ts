import { Controller, Get } from '@nestjs/common';

/**
 * Lightweight liveness probe.
 *
 * The Docker/Swarm healthcheck in `Dockerfile.hf` probes `GET /api/health`
 * (under the global `api` prefix) and expects HTTP 200. This controller
 * provides that endpoint so the healthcheck succeeds instead of 404-ing.
 *
 * It is intentionally dependency-free (no DB/Redis/MinIO calls) so it returns
 * within the healthcheck's 3s timeout even when downstream services are absent.
 */
@Controller()
export class HealthController {
  @Get('health')
  check() {
    return {
      status: 'ok',
      service: 'edumap-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
