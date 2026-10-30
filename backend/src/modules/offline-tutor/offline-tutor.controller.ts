import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OfflineTutorService } from './offline-tutor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';

/**
 * POST /api/offline/tutor — Edge AI Tutor (Idea #7)
 *
 * Proxies to the ai-service FastAPI endpoint, which answers through the
 * shared text cascade (DeepSeek → Gemini → Cloudflare) and falls back to
 * curated Vietnamese templates when no provider is available.
 *
 * Auth: Public endpoint so the offline tutor works even without login
 *       (e.g. students without an account). User context is used if present.
 */
@ApiTags('Offline AI Tutor')
@Controller('offline')
export class OfflineTutorController {
  private readonly logger = new Logger(OfflineTutorController.name);

  constructor(private readonly offlineTutorService: OfflineTutorService) {}

  @Post('tutor')
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: 'F-06: Edge AI Tutor (offline LLM, no internet required)' })
  async tutor(
    @Body()
    body: {
      action: string;
      topic: string;
      material_context?: string;
      difficulty?: string;
      num_questions?: number;
      progression?: Record<string, any>;
    },
    @Request() req: any,
  ) {
    if (!body.action || !body.topic) {
      return {
        success: false,
        message: 'Thiếu trường bắt buộc: action và topic',
      };
    }

    // Pass user context if authenticated (best-effort — endpoint is public)
    const userId = req.user?.id || req.user?.sub;

    return this.offlineTutorService.tutor({
      ...body,
      progression: body.progression || { user_id: userId },
    });
  }

  @Get('status')
  @Public()
  @ApiOperation({ summary: 'Edge AI Tutor status (model loaded, cache)' })
  async status() {
    return this.offlineTutorService.status();
  }
}
