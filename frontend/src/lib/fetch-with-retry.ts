type FetchOptions = RequestInit & { retries?: number; retryDelay?: number; skipAuthRefresh?: boolean };

/**
 * Attempts to silently refresh the JWT access token when a 401 is received.
 * Uses a dynamic import to avoid a circular dependency between
 * auth.service.ts → fetch-with-retry.ts → auth.service.ts.
 *
 * This runs only in the browser (call-site is client-side code).
 */
async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const { authService } = await import('@/src/services/auth.service');
    if (!authService.getRefreshToken()) {
      return false;
    }
    return await authService.refreshAuthTokens();
  } catch (error) {
    console.error('[fetchWithRetry] Token refresh failed:', error);
    return false;
  }
}

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { retries = 3, retryDelay = 1000, skipAuthRefresh = false, ...fetchOptions } = options;

  let lastError: Error | null = null;
  let refreshed = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      if (response.ok) {
        return response;
      }

      // ── 401 handling: try one silent token refresh, then retry once ──
      if (response.status === 401 && !skipAuthRefresh && !refreshed) {
        const ok = await attemptTokenRefresh();
        if (ok) {
          refreshed = true;
          const newToken = (await import('@/src/services/auth.service')).authService.getAccessToken();
          if (newToken) {
            fetchOptions.headers = {
              ...fetchOptions.headers,
              'Authorization': `Bearer ${newToken}`,
            };
            continue; // retry with new token
          }
        }
        return response; // refresh failed — let caller handle 401
      }

      if (response.status >= 500 && attempt < retries) {
        lastError = new Error(`Server error: ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Network request failed');
}

export default fetchWithRetry;
