/**
 * Unwrap the NestJS backend's ResponseInterceptor envelope so BFF route
 * handlers return the raw payload instead of `{ success, data, timestamp }`.
 *
 * The backend's ResponseInterceptor normalises every successful response as
 * `{ success: true, data: <payload>, timestamp: string }`. Some controllers
 * return a pre-formatted `{ success, data }` envelope, which the interceptor
 * leaves untouched (it skips wrapping when `success` is present — see
 * `ResponseInterceptor.intercept`).
 *
 * This helper covers BOTH shapes:
 *   - { success: true, data: <payload> }            → returns <payload>
 *   - { success: true, data: <payload>, timestamp } → returns <payload>
 *   - any value without a `data` key                  → returns the value as-is
 *
 * It is the single source of truth for the legacy inline `data.data ?? data`
 * idiom, which was duplicated (with subtle inconsistencies) across ~124 BFF
 * route handlers. Extracting it here makes the unwrap logic unit-testable and
 * decouples the BFF from the exact envelope shape.
 */
export function unwrapApiResponse<T = unknown>(json: unknown): T {
  const obj = json as any;
  // Mirrors `data.data ?? data` but null-safe via optional chaining.
  return obj?.data ?? obj;
}
