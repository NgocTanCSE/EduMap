import { useCallback, useEffect, useState, useRef } from 'react';

/**
 * Generic async hook for screen-level data fetching.
 * Returns { data, error, loading, execute, reset } so screens can call an API
 * on mount or on demand without boilerplate.
 */
export function useAsync<T = any>(fn?: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(!!fn);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const execute = useCallback(async (...args: any[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await (fnRef.current as any)(...args);
      setData(result);
      return result;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (fn) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, error, loading, execute, reset };
}
