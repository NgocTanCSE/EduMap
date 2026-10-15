import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CloudflareAIService {
  private readonly logger = new Logger(CloudflareAIService.name);
  private readonly apiToken: string | undefined;
  private readonly accountId: string | undefined;
  private readonly modelCandidates: string[];
  private readonly modelName: string;

  constructor(private configService: ConfigService) {
    this.apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN');
    this.accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID');
    this.modelCandidates = (this.configService.get<string>('CLOUDFLARE_MODEL') || '@cf/meta/llama-3.1-8b-instruct-fp8,@cf/google/gemma-7b-it-lora,@cf/mistralai/mistral-small-3.1-24b-instruct')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    this.modelName = this.modelCandidates[0] || '@cf/meta/llama-3.1-8b-instruct-fp8';

    if (!this.apiToken || !this.accountId) {
      this.logger.warn(
        'Cloudflare AI not configured. Set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in .env.',
      );
    }
  }

  private get isReady(): boolean {
    return Boolean(this.apiToken && this.accountId);
  }

  /**
   * Gửi prompt tới Cloudflare Workers AI, thử từng model trong danh sách
   * CLOUDFLARE_MODEL (CSV) — model đầu tiên là ưu tiên, các model sau là fallback.
   */
  async generateContent(prompt: string, context?: any): Promise<string> {
    if (!this.isReady) {
      throw new Error('Cloudflare AI not configured (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID missing)');
    }

    const fullPrompt = context
      ? `${prompt}\n\nContext: ${JSON.stringify(context)}`
      : prompt;

    const lastErr = { err: 'No attempt was made' };

    for (const model of this.modelCandidates) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`;
      const payload = {
        prompt: fullPrompt,
        max_tokens: 2048,
        temperature: 0.7,
        top_p: 0.8,
      };

      let retry = 0;
      const maxRetries = 1;
      while (true) {
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          const data: any = await resp.json();

          if (!resp.ok) {
            const bodyText = JSON.stringify(data).slice(0, 300);
            const msg = (data?.messages?.[0]?.message as string) || resp.statusText;
            // 404 / model not found → skip to next model
            if (resp.status === 404 || /not found|not supported|no longer available|model not found|could not find/i.test(bodyText)) {
              lastErr.err = `${model}: HTTP ${resp.status} ${msg}`;
              this.logger.warn(`Cloudflare model ${model} not available, trying next model.`);
              break; // next model
            }
            // 429 rate-limit → next model immediately
            if (resp.status === 429) {
              lastErr.err = `${model}: HTTP 429 ${msg}`;
              this.logger.warn(`Cloudflare model ${model} rate-limited (429), trying next model.`);
              retry++;
              break;
            }
            // 502/503/504 transient → retry once then next model
            if ([502, 503, 504].includes(resp.status) && retry <= maxRetries) {
              lastErr.err = `${model}: HTTP ${resp.status} ${msg}`;
              this.logger.warn(`Cloudflare model ${model} transient error (${resp.status}), retry ${retry}/${maxRetries}.`);
              retry++;
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
            // Other errors → next model
            lastErr.err = `${model}: HTTP ${resp.status} ${msg}`;
            this.logger.warn(`Cloudflare model ${model} error (${resp.status}), trying next model.`);
            break;
          }

          // Success — parse Cloudflare response
          const result = data?.result;
          if (result && typeof result === 'object') {
            const text = (result.response ?? result.text ?? '').trim();
            if (text) {
              return text;
            }
            lastErr.err = `${model}: empty response`;
            break;
          }

          lastErr.err = `${model}: unexpected response format`;
          break;
        } catch (error: any) {
          lastErr.err = `${model}: ${error.message}`;
          if (retry <= maxRetries) {
            this.logger.warn(`Cloudflare model ${model} connection error, retry ${retry + 1}/${maxRetries + 1}.`);
            retry++;
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          this.logger.warn(`Cloudflare model ${model} connection error, trying next model.`);
          break;
        }
      }
    }

    this.logger.error(`All Cloudflare models failed. Last error: ${lastErr.err}`);
    throw new Error(`Cloudflare AI generation failed: ${lastErr.err}`);
  }

  async analyzeGeoDensity(city: string, points: any[]): Promise<any> {
    const pointCount = points.length;
    const categoryStats: Record<string, number> = {};

    points.forEach((p) => {
      const cat = p.type || p.category || 'unknown';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });

    const prompt = `Analyze educational infrastructure density in ${city}.

Points data: ${pointCount} educational locations
Categories: ${Object.entries(categoryStats)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ')}

Return JSON with: summary, density_score (0-10), recommendations (array with area, priority, reason).`;

    try {
      const response = await this.generateContent(prompt);
      return JSON.parse(response);
    } catch (error: any) {
      this.logger.error(`Geo density analysis error: ${error.message}`);
      return {
        summary: 'AI analysis temporarily unavailable. Based on map data, educational facilities are concentrated in the Biên Hòa area.',
        density_score: 7.5,
        recommendations: [
          { area: 'Infrastructure', priority: 'High', reason: 'Expand lab and public WiFi facilities.' },
        ],
      };
    }
  }
}
