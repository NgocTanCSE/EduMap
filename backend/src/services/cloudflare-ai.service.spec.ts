import { execFile } from 'child_process';
import { CloudflareAIService } from './cloudflare-ai.service';
jest.mock('child_process');
const mockedExecFile = execFile as unknown as jest.Mock;
describe('CloudflareAIService (HF Spaces, curl transport)', () => {
    let service: CloudflareAIService;
    const savedHfToken = process.env.HF_TOKEN;
    const mockConfig = {
        get: jest.fn((key: string) => {
            const map: Record<string, string | undefined> = {
                CLOUDFLARE_API_TOKEN: 'cf-token',
                CLOUDFLARE_ACCOUNT_ID: 'cf-account',
                CF_AI_GATEWAY_ENABLED: 'false',
                CF_AI_GATEWAY_ID: undefined,
                CLOUDFLARE_MODEL: '@cf/google/gemma-7b-it-lora',
            };
            return map[key];
        }),
    };
    beforeEach(() => {
        mockedExecFile.mockReset();
        process.env.HF_TOKEN = 'hf-token';
        service = new CloudflareAIService(mockConfig as any);
    });
    afterEach(() => {
        process.env.HF_TOKEN = savedHfToken;
    });
    function mockCurlRoutes(routes: {
        urlContains: string;
        status: number;
        body: string;
        error?: string;
    }[]): void {
        mockedExecFile.mockImplementation((_file, args: string[], _opts, cb: any) => {
            const url = args[args.length - 1];
            const route = routes.find((r) => url.includes(r.urlContains));
            if (route && route.error) {
                cb(new Error(route.error), '', 'curl: (7)');
            }
            else if (route) {
                cb(null, `${route.body}\n__EDUMAP_STATUS__${route.status}`, '');
            }
            else {
                cb(new Error('no mock for url'), '', '');
            }
            return {} as any;
        });
    }
    it('calls Cloudflare via curl with --ipv4 --insecure (not native fetch)', async () => {
        mockCurlRoutes([{
                urlContains: 'cloudflare.com',
                status: 200,
                body: JSON.stringify({ result: { response: 'Kết quả AI từ Cloudflare' } }),
            }]);
        const text = await service.generateContent('Xin chào');
        expect(text).toBe('Kết quả AI từ Cloudflare');
        expect(mockedExecFile).toHaveBeenCalledTimes(1);
        expect(mockedExecFile.mock.calls[0][0]).toBe('curl');
        const args = mockedExecFile.mock.calls[0][1] as string[];
        expect(args).toContain('--ipv4');
        expect(args).toContain('--insecure');
    });
    it('falls back to HuggingFace via curl when Cloudflare returns 404', async () => {
        mockCurlRoutes([
            { urlContains: 'cloudflare.com', status: 404, body: '' },
            { urlContains: 'huggingface', status: 200, body: '[{"generated_text":"Kết quả từ HuggingFace"}]' },
        ]);
        const text = await service.generateContent('Xin chào');
        expect(text).toBe('Kết quả từ HuggingFace');
        expect(mockedExecFile).toHaveBeenCalledTimes(2);
    });
    it('trips the Cloudflare circuit breaker on a curl connection error, then uses HF', async () => {
        mockCurlRoutes([
            { urlContains: 'cloudflare.com', status: 0, body: '', error: 'curl: (7) Failed to connect — IPv6 blackhole' },
            { urlContains: 'huggingface', status: 200, body: '[{"generated_text":"HF fallback text"}]' },
        ]);
        const text = await service.generateContent('Xin chào');
        expect(text).toBe('HF fallback text');
        expect((service as any)._cfDownUntil).toBeGreaterThan(0);
    });
    it('trips the circuit on 401 auth failure and stops retrying Cloudflare', async () => {
        delete process.env.HF_TOKEN;
        const svc = new CloudflareAIService(mockConfig as any);
        mockCurlRoutes([
            { urlContains: 'cloudflare.com', status: 401, body: JSON.stringify({ error: 'invalid api key' }) },
        ]);
        await expect(svc.generateContent('hello')).rejects.toThrow(/AI generation failed/);
        expect((svc as any)._cfDownUntil).toBeGreaterThan(0);
    });
    it('analyzeGeoDensity returns a template fallback when the LLM is unreachable', async () => {
        mockCurlRoutes([
            { urlContains: 'cloudflare.com', status: 0, body: '', error: 'curl: (7) could not resolve host' },
            { urlContains: 'huggingface', status: 401, body: JSON.stringify({ error: 'invalid token' }) },
        ]);
        const result = await service.analyzeGeoDensity('Biên Hòa', [
            { type: 'school', lat: 10.95, lng: 106.87 },
        ]);
        expect(result.density_score).toBe(7.5);
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.summary).toBeTruthy();
    }, 20000);
    it('throws "AI Service not configured" when no provider keys are present', async () => {
        delete process.env.HF_TOKEN;
        const emptyConfig = { get: jest.fn(() => undefined) };
        const svc = new CloudflareAIService(emptyConfig as any);
        await expect(svc.generateContent('hi')).rejects.toThrow(/AI Service not configured/);
    }, 10000);
});
