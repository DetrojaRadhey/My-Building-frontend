import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheManager, CacheConfig } from '../utils/CacheManager';
import { useCache } from '../context/CacheContext';

export interface UseCachedDataOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  config?: Partial<CacheConfig>;
  enabled?: boolean;
}

export interface UseCachedDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCachedData<T>({
  key,
  fetcher,
  config,
  enabled = true,
}: UseCachedDataOptions<T>): UseCachedDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { isOnline } = useCache();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const result = await cacheManager.getWithRevalidate<T>(
        key,
        fetcher,
        config,
        (fresh) => {
          if (mountedRef.current) {
            setData(fresh);
            setIsStale(false);
          }
        },
      );
      if (mountedRef.current) {
        setData(result.data);
        setIsStale(result.isStale);
        setError(null);
      }
    } catch (err) {
      // On error, try to return whatever is cached
      const cached = await cacheManager.get<T>(key, config);
      if (mountedRef.current) {
        if (cached !== null) {
          setData(cached);
          setIsStale(true);
        }
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [key, fetcher, config, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-fetch when coming back online
  useEffect(() => {
    if (isOnline && data !== null) {
      load();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(async () => {
    await cacheManager.invalidate(key);
    await load();
  }, [key, load]);

  return { data, isLoading, isStale, error, refetch };
}
