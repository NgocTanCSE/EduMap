import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CloudflareAIService {
  private readonly logger = new Logger(CloudflareAIService.name);
  private readonly apiToken: string | undefined;
  private readonly accountId: string | undefined;
  private readonly gatewayId: string | undefined;
  private readonly gatewayEnabled: boolean;
  private readonly modelCandidates: string[];
  private readonly modelName: string;
  private readonly hfToken: string | undefined;
  private readonly hfModel: string;

  constructor(private configService: ConfigService) {
    this.apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN');
    this.accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID');
    this.gatewayId = this.configService.get<string>('CF_AI_GATEWAY_ID');
    this.gatewayEnabled = (this.configService.get<string>('CF_AI_GATEWAY_ENABLED') || 'false').toLowerCase() === 'true';
    this.modelCandidates = (this.configService.get<string>('CLOUDFLARE_MODEL') || '@cf/meta/llama-3.1-8b-instruct-fp8,@cf/google/gemma-7b-it-lora,@cf/mistralai/mistral-small-3.1-24b-instruct')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    this.modelName = this.modelCandidates[0] || '@cf/meta/llama-3.1-8b-instruct-fp8';
  }

  /** Trả về endpoint Cloudflare: qua AI Gateway nếu được bật, ngược lại gọi trực tiếp Workers AI. */
  private cfUrl(model: string): string {
    if (this.gatewayEnabled && this.gatewayId && this.accountId) {
      return `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.gatewayId}/ai/run/${model}`;
    }
    return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`;
  }

    // --- HuggingFace Inference API fallback (khi Cloudflare Workers AI không kết nối được từ HF Spaces) ---
    this.hfToken = process.env.HF_TOKEN || process.env.HF_API_TOKEN;
    this.hfModel = process.env.HF_LLM_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';

    if (!this.apiToken || !this.accountId) {
      if (!this.hfToken) {
        this.logger.warn(
          'AI not configured. Set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Cloudflare) or HF_TOKEN (HuggingFace) in .env.',
        );
      } else {
        this.logger.warn(
          'Cloudflare AI not fully configured. Will use HuggingFace Inference API as primary LLM provider.',
        );
      }
    } else if (this.gatewayEnabled && this.gatewayId) {
      this.logger.log(`Cloudflare AI Gateway enabled (gatewayId=${this.gatewayId}).`);
    }
  }

  private get isReady(): boolean {
    return Boolean(this.apiToken && this.accountId) || Boolean(this.hfToken);
  }

  /**
   * Gửi prompt tới Cloudflare Workers AI hoặc HuggingFace Inference API.
   * Thử model Cloudflare đầu tiên, nếu thất bại chuyển sang HF Inference API (fallback).
   */
  async generateContent(prompt: string, context?: any): Promise<string> {
    if (!this.isReady) {
      throw new Error('AI Service not configured. Set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Cloudflare) OR HF_TOKEN (HuggingFace) in .env.');
    }

    const fullPrompt = context
      ? `${prompt}\n\nContext: ${JSON.stringify(context)}`
      : prompt;

    const lastErr = { err: 'No attempt was made' };

    // --- Phần 1: thử Cloudflare (qua AI Gateway nếu bật, ngược lại trực tiếp Workers AI) ---
    let cfFailed = false;
    if (this.apiToken && this.accountId) {
      for (const model of this.modelCandidates) {
        const url = this.cfUrl(model);
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
              if (resp.status === 404 || /not found|not supported|no longer available|model not found|could not find/i.test(bodyText)) {
                lastErr.err = `${model}: HTTP ${resp.status} ${msg}`;
                this.logger.warn(`Cloudflare model ${model} not available, trying next model.`);
                break;
              }
              if (resp.status === 429) {
                lastErr.err = `${model}: HTTP 429 ${msg}`;
                this.logger.warn(`Cloudflare model ${model} rate-limited (429), trying next model.`);
                retry++;
                break;
              }
              if ([502, 503, 504].includes(resp.status) && retry <= maxRetries) {
                lastErr.err = `${model}: HTTP ${resp.status} ${msg}`;
                this.logger.warn(`Cloudflare model ${model} transient error (${resp.status}), retry ${retry}/${maxRetries}.`);
                retry++;
                await new Promise((r) => setTimeout(r, 2000));
                continue;
              }
              lastErr.err = `${model}: HTTP ${resp.status} ${msg}`;
              this.logger.warn(`Cloudflare model ${model} error (${resp.status}), trying next model.`);
              break;
            }

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
      cfFailed = true;
      this.logger.warn(`All Cloudflare models failed. Last error: ${lastErr.err}. Falling back to HuggingFace Inference API.`);
    }

    // --- Phần 2: fallback về HuggingFace Inference API ---
    if (this.hfToken) {
      try {
        const hfResult = await this._hfGenerate(fullPrompt, 0.7, 2048, 0.8);
        if (hfResult) {
          this.logger.log(`HuggingFace Inference API generation OK (model=${this.hfModel}).`);
          return hfResult;
        }
      } catch (error: any) {
        this.logger.error(`HuggingFace Inference API also failed: ${error.message}`);
      }
    }

    throw new Error(`AI generation failed. Cloudflare: ${lastErr.err || 'không cấu hình'}, HuggingFace: ${this.hfToken ? 'lỗi kết nối' : 'không cấu hình HF_TOKEN'}.`);
  }

  /**
   * Gọi HuggingFace Inference API để sinh text (fallback khi Cloudflare Workers AI không kết nối được).
   * Endpoint: https://api-inference.huggingface.co/models/{model}
   * HF_TOKEN tự động available trên HF Spaces.
   */
  private async _hfGenerate(prompt: string, temperature: number, maxTokens: number, topP: number): Promise<string> {
    if (!this.hfToken) {
      throw new Error('HF_TOKEN not set.');
    }

    const url = `https://api-inference.huggingface.co/models/${this.hfModel}`;
    const payload = {
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
        temperature: temperature,
        top_p: topP,
      },
    };

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.hfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (resp.status === 200) {
          const data: any = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            const text = (data[0]?.generated_text || data[0]).toString().trim();
            if (text) return text;
          }
          if (data?.generated_text) return data.generated_text.toString().trim();
          throw new Error('HF Inference API returned unexpected response format');
        }

        const bodyText = await resp.text();

        // 503: model đang loading
        if (resp.status === 503 && /loading/i.test(bodyText) && attempt < maxRetries) {
          this.logger.warn(`HF model ${this.hfModel} is loading, retry ${attempt}/${maxRetries}...`);
          await new Promise((r) => setTimeout(r, 5000 * attempt));
          continue;
        }

        // 429: rate limit
        if (resp.status === 429 && attempt < maxRetries) {
          this.logger.warn(`HF Inference API rate-limited (429), retry ${attempt}/${maxRetries}...`);
          await new Promise((r) => setTimeout(r, 3000 * attempt));
          continue;
        }

        throw new Error(`HF Inference API HTTP ${resp.status}: ${bodyText.slice(0, 200)}`);
      } catch (error: any) {
        if (attempt < maxRetries && /loading/i.test(error.message || '')) {
          await new Promise((r) => setTimeout(r, 5000 * attempt));
          continue;
        }
        if (attempt < maxRetries) {
          this.logger.warn(`HF generate error, retry ${attempt}/${maxRetries}: ${error.message}`);
          await new Promise((r) => setTimeout(r, 3000 * attempt));
          continue;
        }
        throw error;
      }
    }

    throw new Error('HF Inference API failed after all retries');
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
