export function getBackendUrl(): string {
    const raw = process.env.BACKEND_URL ||
        (process.env.NEXT_PUBLIC_API_URL?.startsWith('http') ? process.env.NEXT_PUBLIC_API_URL : undefined) ||
        (process.env.API_URL?.startsWith('http') ? process.env.API_URL : undefined) ||
        'http://127.0.0.1:3000';
    const base = raw
        .replace(/\/+$/, '')
        .replace(/\/api$/, '');
    return `${base}/api`;
}
export function getAIServiceUrl(): string {
    const raw = process.env.AI_SERVICE_URL ||
        'http://127.0.0.1:8000';
    return raw.replace(/\/+$/, '');
}
