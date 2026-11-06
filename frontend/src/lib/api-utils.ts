export function unwrapApiResponse<T = unknown>(json: unknown): T {
    const obj = json as any;
    return obj?.data ?? obj;
}
