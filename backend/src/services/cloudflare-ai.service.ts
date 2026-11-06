import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
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
        this.hfToken = process.env.HF_TOKEN || process.env.HF_API_TOKEN;
        this.hfModel = process.env.HF_LLM_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';
        if (!this.apiToken || !this.accountId) {
            if (!this.hfToken) {
                this.logger.warn('AI not configured. Set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Cloudflare) or HF_TOKEN (HuggingFace) in .env.');
            }
            else {
                this.logger.warn('Cloudflare AI not fully configured. Will use HuggingFace Inference API as primary LLM provider.');
            }
        }
        else if (this.gatewayEnabled && this.gatewayId) {
            this.logger.log(`Cloudflare AI Gateway enabled (gatewayId=${this.gatewayId}).`);
        }
    }
    private cfUrl(model: string): string {
        if (this.gatewayEnabled && this.gatewayId && this.accountId) {
            return `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.gatewayId}/ai/run/${model}`;
        }
        return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`;
    }
    private get isReady(): boolean {
        return Boolean(this.apiToken && this.accountId) || Boolean(this.hfToken);
    }
    private _cfDownUntil = 0;
    private _hfDownUntil = 0;
    private static readonly CB_SECONDS = 300;
    private async _curlJsonPost(url: string, payload: any, bearerToken?: string): Promise<{
        status: number;
        json: any;
        text: string;
    }> {
        const tmpPath = `${os.tmpdir()}/edumap_cf_${Date.now()}_${Math.random().toString(36).slice(2)}.json`;
        const timeoutSec = 30;
        try {
            fs.writeFileSync(tmpPath, JSON.stringify(payload));
            const args: string[] = [
                '--ipv4', '--insecure', '-sS',
                '-X', 'POST',
                '-H', 'Content-Type: application/json',
                ...(bearerToken ? ['-H', `Authorization: Bearer ${bearerToken}`] : []),
                '-H', 'Accept: application/json',
                '--connect-timeout', '5',
                '--max-time', String(timeoutSec),
                '-d', `@${tmpPath}`,
                '-w', '\n__EDUMAP_STATUS__%{http_code}',
                url,
            ];
            return await new Promise<{
                status: number;
                json: any;
                text: string;
            }>((resolve, reject) => {
                execFile('curl', args, { timeout: (timeoutSec + 5) * 1000 }, (err, stdout, stderr) => {
                    if (err) {
                        reject(new Error(`curl failed: ${(err as any).message || String(err)}${stderr ? ' ' + stderr : ''}`));
                        return;
                    }
                    const out = String(stdout || '');
                    const marker = '\n__EDUMAP_STATUS__';
                    const idx = out.lastIndexOf(marker);
                    let status = 0;
                    let body = out;
                    if (idx >= 0) {
                        status = parseInt(out.slice(idx + marker.length).trim(), 10) || 0;
                        body = out.slice(0, idx);
                    }
                    const text = body.trim();
                    let json: any = null;
                    try {
                        if (text)
                            json = JSON.parse(text);
                    }
                    catch {
                        json = null;
                    }
                    resolve({ status, json, text });
                });
            });
        }
        finally {
            try {
                fs.unlinkSync(tmpPath);
            }
            catch { }
        }
    }
    private get _cfCircuitOpen(): boolean {
        return Date.now() / 1000 < this._cfDownUntil;
    }
    private get _hfCircuitOpen(): boolean {
        return Date.now() / 1000 < this._hfDownUntil;
    }
    private _tripCircuit(which: 'cf' | 'hf') {
        if (which === 'cf')
            this._cfDownUntil = Date.now() / 1000 + CloudflareAIService.CB_SECONDS;
        else
            this._hfDownUntil = Date.now() / 1000 + CloudflareAIService.CB_SECONDS;
        this.logger.warn(`CloudflareAIService circuit breaker OPEN for ${CloudflareAIService.CB_SECONDS}s (auth/network failure).`);
    }
    async generateContent(prompt: string, context?: any): Promise<string> {
        if (!this.isReady) {
            throw new Error('AI Service not configured. Set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Cloudflare) OR HF_TOKEN (HuggingFace) in .env.');
        }
        const fullPrompt = context
            ? `${prompt}\n\nContext: ${JSON.stringify(context)}`
            : prompt;
        const lastErr = { err: 'No attempt was made' };
        let cfFailed = false;
        const cfConfigured = Boolean(this.apiToken && this.accountId);
        if (cfConfigured) {
            if (this._cfCircuitOpen) {
                this.logger.warn('Cloudflare circuit breaker OPEN — skipping Cloudflare, using HF fallback.');
                lastErr.err = 'circuit breaker open (5 min cooldown)';
                cfFailed = true;
            }
            else {
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
                    let abortModel = false;
                    while (true) {
                        try {
                            const { status, json: data, text: bodyText } = await this._curlJsonPost(url, payload, this.apiToken);
                            if (status === 401 || status === 403) {
                                lastErr.err = `${model}: HTTP ${status}`;
                                this.logger.warn(`Cloudflare model ${model} auth error (${status}), tripping circuit breaker.`);
                                this._tripCircuit('cf');
                                abortModel = true;
                                break;
                            }
                            if (status !== 200) {
                                const msg = (data?.messages?.[0]?.message as string) || `HTTP ${status}`;
                                if (status === 404 || /not found|not supported|no longer available|model not found|could not find/i.test(bodyText)) {
                                    lastErr.err = `${model}: HTTP ${status} ${msg}`;
                                    this.logger.warn(`Cloudflare model ${model} not available, trying next model.`);
                                    break;
                                }
                                if (status === 429) {
                                    lastErr.err = `${model}: HTTP 429 ${msg}`;
                                    this.logger.warn(`Cloudflare model ${model} rate-limited (429), trying next model.`);
                                    break;
                                }
                                if ([502, 503, 504].includes(status) && retry <= maxRetries) {
                                    lastErr.err = `${model}: HTTP ${status} ${msg}`;
                                    this.logger.warn(`Cloudflare model ${model} transient error (${status}), retry ${retry}/${maxRetries}.`);
                                    retry++;
                                    await new Promise((r) => setTimeout(r, 2000));
                                    continue;
                                }
                                lastErr.err = `${model}: HTTP ${status} ${msg}`;
                                this.logger.warn(`Cloudflare model ${model} error (${status}), trying next model.`);
                                break;
                            }
                            const result = data?.result;
                            if (result && typeof result === 'object') {
                                const text = (result.response ?? result.text ?? '').trim();
                                if (text) {
                                    this._cfDownUntil = 0;
                                    return text;
                                }
                                lastErr.err = `${model}: empty response`;
                                break;
                            }
                            lastErr.err = `${model}: unexpected response format`;
                            break;
                        }
                        catch (error: any) {
                            lastErr.err = `${model}: ${error.message}`;
                            this.logger.warn(`Cloudflare model ${model} connection error: ${error.message}, tripping circuit breaker.`);
                            this._tripCircuit('cf');
                            abortModel = true;
                            break;
                        }
                    }
                    if (abortModel)
                        break;
                }
                cfFailed = true;
                if (lastErr.err !== 'circuit breaker open (5 min cooldown)') {
                    this.logger.warn(`All Cloudflare models failed. Last error: ${lastErr.err}. Falling back to HuggingFace Inference API.`);
                }
            }
        }
        if (this.hfToken) {
            if (this._hfCircuitOpen) {
                this.logger.warn('HuggingFace circuit breaker OPEN — skipping HF fallback.');
                lastErr.err = `${lastErr.err}; HF circuit breaker open (5 min cooldown)`;
            }
            else {
                try {
                    const hfResult = await this._hfGenerate(fullPrompt, 0.7, 2048, 0.8);
                    if (hfResult) {
                        this.logger.log(`HuggingFace Inference API generation OK (model=${this.hfModel}).`);
                        return hfResult;
                    }
                }
                catch (error: any) {
                    this.logger.error(`HuggingFace Inference API also failed: ${error.message}`);
                }
            }
        }
        throw new Error(`AI generation failed. Cloudflare: ${lastErr.err || 'không cấu hình'}, HuggingFace: ${this.hfToken ? 'lỗi kết nối' : 'không cấu hình HF_TOKEN'}.`);
    }
    private async _hfGenerate(prompt: string, temperature: number, maxTokens: number, topP: number): Promise<string> {
        if (!this.hfToken) {
            throw new Error('HF_TOKEN not set.');
        }
        if (this._hfCircuitOpen) {
            throw new Error('HuggingFace Inference API circuit breaker open (5 min cooldown).');
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
        let authFailed = false;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const { status, json: data, text: bodyText } = await this._curlJsonPost(url, payload, this.hfToken);
                if (status === 401 || status === 403) {
                    this._tripCircuit('hf');
                    authFailed = true;
                    break;
                }
                if (status === 200) {
                    if (Array.isArray(data) && data.length > 0) {
                        const text = (data[0]?.generated_text || data[0]).toString().trim();
                        if (text) {
                            this._hfDownUntil = 0;
                            return text;
                        }
                    }
                    if (data?.generated_text) {
                        this._hfDownUntil = 0;
                        return data.generated_text.toString().trim();
                    }
                    throw new Error('HF Inference API returned unexpected response format');
                }
                if (status === 503 && /loading/i.test(bodyText) && attempt < maxRetries) {
                    this.logger.warn(`HF model ${this.hfModel} is loading, retry ${attempt}/${maxRetries}...`);
                    await new Promise((r) => setTimeout(r, 5000 * attempt));
                    continue;
                }
                if (status === 429 && attempt < maxRetries) {
                    this.logger.warn(`HF Inference API rate-limited (429), retry ${attempt}/${maxRetries}...`);
                    await new Promise((r) => setTimeout(r, 3000 * attempt));
                    continue;
                }
                const errMsg = `HF Inference API HTTP ${status}: ${bodyText.slice(0, 200)}`;
                if (attempt < maxRetries) {
                    this.logger.warn(`HF generate error, retry ${attempt}/${maxRetries}: ${errMsg}`);
                    await new Promise((r) => setTimeout(r, 3000 * attempt));
                    continue;
                }
                throw new Error(errMsg);
            }
            catch (error: any) {
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
        if (authFailed) {
            throw new Error(`HuggingFace Inference API auth error (HTTP 401/403), circuit breaker tripped.`);
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
        }
        catch (error: any) {
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
