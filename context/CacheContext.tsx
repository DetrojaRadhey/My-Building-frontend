import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { cacheManager, CacheMetrics } from '../utils/CacheManager';

interface CacheContextValue {
  isOnline: boolean;
  cacheMetrics: CacheMetrics | null;
  clearCache: (namespace?: string) => Promise<void>;
  refreshModule: (module: string) => Promise<void>;
}

const CacheContext = createContext<CacheContextValue | null>(null);

export function CacheProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      cacheManager.setNetworkStatus(online);
    });
    return unsubscribe;
  }, []);

  const clearCache = useCallback(async (namespace?: string) => {
    await cacheManager.clear(namespace);
    const metrics = await cacheManager.getMetrics();
    setCacheMetrics(metrics);
  }, []);

  const refreshModule = useCallback(async (module: string) => {
    await cacheManager.invalidate(`${module}:*`);
  }, []);

  return (
    <CacheContext.Provider value={{ isOnline, cacheMetrics, clearCache, refreshModule }}>
      {children}
    </CacheContext.Provider>
  );
}

export function useCache(): CacheContextValue {
  const ctx = useContext(CacheContext);
  if (!ctx) throw new Error('useCache must be used within CacheProvider');
  return ctx;
}
