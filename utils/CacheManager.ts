/**
 * CacheManager - Core caching infrastructure for My_Building app
 *
 * Implements stale-while-revalidate strategy for instant content display
 * with background data refresh. Supports all modules and all user roles.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

// ============================================================================
// Type Definitions and Interfaces
// ============================================================================

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
  key: string;
  sensitive: boolean;
}

export interface CacheConfig {
  ttl: number;       // Time-to-live in milliseconds
  maxAge: number;    // Maximum age for stale data in milliseconds
  sensitive: boolean;
  namespace: string;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  totalSize: number; // bytes (estimated)
  entryCount: number;
}

export interface CacheError {
  type: 'storage' | 'encryption' | 'corruption' | 'network' | 'eviction' | 'optimistic';
  message: string;
  key?: string;
  timestamp: number;
  context?: Record<string, any>;
}

interface StoredCacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
  version: string;
  key: string;
  sensitive: boolean;
  namespace: string;
  lastAccessed: number;
  accessCount: number;
  isOptimistic?: boolean;
  previousData?: any;
}

// ============================================================================
// Cache Configuration Presets
// ============================================================================

export const CACHE_PRESETS: Record<string, CacheConfig> = {
  userSpecific: {
    ttl: 5 * 60 * 1000,
    maxAge: 24 * 60 * 60 * 1000,
    sensitive: false,
    namespace: 'user',
  },
  buildingWide: {
    ttl: 15 * 60 * 1000,
    maxAge: 24 * 60 * 60 * 1000,
    sensitive: false,
    namespace: 'building',
  },
  static: {
    ttl: 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sensitive: false,
    namespace: 'static',
  },
  sensitive: {
    ttl: 5 * 60 * 1000,
    maxAge: 24 * 60 * 60 * 1000,
    sensitive: true,
    namespace: 'sensitive',
  },
};

// ============================================================================
// Cache Error Logger
// ============================================================================

export class CacheErrorLogger {
  private errors: CacheError[] = [];
  private readonly maxErrors = 100;

  log(error: CacheError): void {
    this.errors.push(error);
    if (this.errors.length > this.maxErrors) this.errors.shift();
    if (__DEV__) {
      console.warn('[CacheManager]', error.type, error.message, error.key ?? '');
    }
  }

  getErrors(): CacheError[] { return [...this.errors]; }
  clearErrors(): void { this.errors = []; }
  getRecentErrors(count = 10): CacheError[] { return this.errors.slice(-count); }
}

// ============================================================================
// Cache Manager
// ============================================================================

export class CacheManager {
  private errorLogger = new CacheErrorLogger();
  private isOnlineStatus = true;
  private appVersion = '1.0.0';
  private readonly maxCacheSize = 50 * 1024 * 1024; // 50 MB
  private revalidationCallbacks = new Map<string, Array<(data: any) => void>>();

  private metrics: CacheMetrics = {
    hits: 0, misses: 0, totalRequests: 0,
    hitRate: 0, totalSize: 0, entryCount: 0,
  };

  constructor() {
    NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      const wasOffline = !this.isOnlineStatus;
      this.isOnlineStatus = online;
      if (online && wasOffline) {
        // Reconnected — trigger revalidation for all registered callbacks
        this.revalidationCallbacks.forEach((cbs) => cbs.forEach(cb => cb(null)));
      }
    });
  }

  // --------------------------------------------------------------------------
  // Network
  // --------------------------------------------------------------------------

  setNetworkStatus(isOnline: boolean): void { this.isOnlineStatus = isOnline; }
  isOnline(): boolean { return this.isOnlineStatus; }
  setAppVersion(version: string): void { this.appVersion = version; }
  getErrorLogger(): CacheErrorLogger { return this.errorLogger; }

  // --------------------------------------------------------------------------
  // Task 2.1 — Key generation with role + building isolation
  // --------------------------------------------------------------------------

  generateKey(
    module: string,
    endpoint: string,
    params?: Record<string, any>,
    role?: string,
    buildingId?: string,
  ): string {
    const parts: string[] = [module];
    if (role) parts.push(role);
    if (buildingId) parts.push(buildingId);
    parts.push(endpoint);

    if (params && Object.keys(params).length > 0) {
      const normalized = Object.keys(params)
        .sort()
        .map(k => `${k}=${JSON.stringify(params[k])}`)
        .join('&');
      parts.push(normalized);
    }

    return parts.join(':').replace(/[^a-zA-Z0-9\-_:]/g, '_');
  }

  // --------------------------------------------------------------------------
  // Task 2.3 — get / set with AsyncStorage + metadata
  // --------------------------------------------------------------------------

  async get<T>(key: string, config?: Partial<CacheConfig>): Promise<T | null> {
    this.metrics.totalRequests++;
    try {
      const stored = await this.readEntry(key, config?.sensitive);
      if (!stored) return this.miss();

      if (stored.version !== this.appVersion) {
        await this.removeEntry(key, stored.sensitive);
        return this.miss();
      }

      const maxAge = config?.maxAge ?? CACHE_PRESETS.userSpecific.maxAge;
      if (Date.now() - stored.timestamp > maxAge) {
        await this.removeEntry(key, stored.sensitive);
        return this.miss();
      }

      stored.lastAccessed = Date.now();
      stored.accessCount++;
      await this.writeEntry(key, stored, stored.sensitive);

      this.metrics.hits++;
      this.updateHitRate();
      return stored.data as T;
    } catch (err) {
      this.logError('storage', `get failed: ${err}`, key);
      return this.miss();
    }
  }

  async set<T>(key: string, data: T, config?: Partial<CacheConfig>): Promise<void> {
    try {
      const cfg = this.mergeConfig(config);
      const now = Date.now();
      const entry: StoredCacheEntry = {
        data, timestamp: now, expiresAt: now + cfg.ttl,
        version: this.appVersion, key,
        sensitive: cfg.sensitive, namespace: cfg.namespace,
        lastAccessed: now, accessCount: 1,
      };
      await this.writeEntry(key, entry, cfg.sensitive);
      await this.evictIfNeeded();
    } catch (err) {
      this.logError('storage', `set failed: ${err}`, key);
    }
  }

  // --------------------------------------------------------------------------
  // Task 3.1 — TTL / stale check helper
  // --------------------------------------------------------------------------

  isStale(entry: StoredCacheEntry, config?: Partial<CacheConfig>): boolean {
    const ttl = config?.ttl ?? CACHE_PRESETS.userSpecific.ttl;
    return Date.now() > entry.timestamp + ttl;
  }

  // --------------------------------------------------------------------------
  // Task 4.1 — Stale-while-revalidate
  // --------------------------------------------------------------------------

  async getWithRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    config?: Partial<CacheConfig>,
    onUpdate?: (data: T) => void,
  ): Promise<{ data: T; isStale: boolean }> {
    const stored = await this.readEntry(key, config?.sensitive);

    if (stored) {
      const stale = this.isStale(stored, config);

      // Always return cached data immediately
      if (this.isOnlineStatus) {
        // Background revalidation
        this.revalidateInBackground(key, fetcher, config, onUpdate);
      }

      return { data: stored.data as T, isStale: stale };
    }

    // Cache miss — fetch fresh
    try {
      const fresh = await fetcher();
      await this.set(key, fresh, config);
      if (onUpdate) onUpdate(fresh);
      return { data: fresh, isStale: false };
    } catch (err) {
      this.logError('network', `fetch failed on cache miss: ${err}`, key);
      throw err;
    }
  }

  private revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    config?: Partial<CacheConfig>,
    onUpdate?: (data: T) => void,
  ): void {
    Promise.resolve().then(async () => {
      try {
        const fresh = await fetcher();
        await this.set(key, fresh, config);
        if (onUpdate) onUpdate(fresh);
      } catch (err) {
        this.logError('network', `background revalidation failed: ${err}`, key);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Task 5.1 — Network-aware: already handled in constructor + isOnline()
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // Task 7.1 — Cache invalidation
  // --------------------------------------------------------------------------

  async invalidate(pattern: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      const regex = new RegExp(`^${escaped}$`);
      const toRemove = allKeys.filter(k => regex.test(k));
      if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
    } catch (err) {
      this.logError('storage', `invalidate failed: ${err}`);
    }
  }

  async clear(namespace?: string): Promise<void> {
    try {
      if (namespace) {
        await this.invalidate(`${namespace}:*`);
      } else {
        await AsyncStorage.clear();
      }
      this.resetMetrics();
    } catch (err) {
      this.logError('storage', `clear failed: ${err}`);
    }
  }

  // --------------------------------------------------------------------------
  // Task 8.1 — LRU eviction
  // --------------------------------------------------------------------------

  async evictLRU(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const entries: Array<{ key: string; entry: StoredCacheEntry }> = [];

      for (const k of allKeys) {
        const e = await this.readEntry(k, false);
        if (e) entries.push({ key: k, entry: e });
      }

      // Score = lastAccessed + (accessCount * 1000ms bonus)
      entries.sort((a, b) =>
        (a.entry.lastAccessed + a.entry.accessCount * 1000) -
        (b.entry.lastAccessed + b.entry.accessCount * 1000)
      );

      const toRemove = Math.ceil(entries.length * 0.2);
      const keys = entries.slice(0, toRemove).map(e => e.key);
      if (keys.length > 0) await AsyncStorage.multiRemove(keys);
    } catch (err) {
      this.logError('eviction', `LRU eviction failed: ${err}`);
    }
  }

  // --------------------------------------------------------------------------
  // Task 10.1 — Cache versioning
  // --------------------------------------------------------------------------

  async checkVersion(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('__cache_version__');
      if (stored && stored !== this.appVersion) {
        if (__DEV__) console.warn('[CacheManager] Version mismatch, clearing cache');
        await AsyncStorage.clear();
      }
      await AsyncStorage.setItem('__cache_version__', this.appVersion);
    } catch (err) {
      this.logError('storage', `version check failed: ${err}`);
    }
  }

  // --------------------------------------------------------------------------
  // Task 13.1 — Metrics
  // --------------------------------------------------------------------------

  async getMetrics(): Promise<CacheMetrics> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      this.metrics.entryCount = allKeys.length;
      this.metrics.totalSize = allKeys.length * 1024; // rough estimate
    } catch { /* ignore */ }
    return { ...this.metrics };
  }

  // --------------------------------------------------------------------------
  // Task 15.1 — Cache warming
  // --------------------------------------------------------------------------

  async warmCache(items: Array<{ key: string; fetcher: () => Promise<any>; config?: Partial<CacheConfig> }>): Promise<void> {
    // Fire-and-forget — does not block UI
    Promise.resolve().then(async () => {
      for (const item of items) {
        try {
          const data = await item.fetcher();
          await this.set(item.key, data, item.config);
        } catch (err) {
          this.logError('network', `cache warming failed for key ${item.key}: ${err}`, item.key);
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Task 17.1 — Optimistic updates
  // --------------------------------------------------------------------------

  async setOptimistic<T>(key: string, data: T, config?: Partial<CacheConfig>): Promise<void> {
    try {
      const existing = await this.readEntry(key, config?.sensitive);
      const cfg = this.mergeConfig(config);
      const now = Date.now();
      const entry: StoredCacheEntry = {
        data, timestamp: now, expiresAt: now + cfg.ttl,
        version: this.appVersion, key,
        sensitive: cfg.sensitive, namespace: cfg.namespace,
        lastAccessed: now, accessCount: 1,
        isOptimistic: true,
        previousData: existing?.data ?? null,
      };
      await this.writeEntry(key, entry, cfg.sensitive);
    } catch (err) {
      this.logError('optimistic', `setOptimistic failed: ${err}`, key);
    }
  }

  async confirmOptimistic<T>(key: string, serverData: T, config?: Partial<CacheConfig>): Promise<void> {
    await this.set(key, serverData, config);
  }

  async revertOptimistic(key: string, config?: Partial<CacheConfig>): Promise<any> {
    try {
      const stored = await this.readEntry(key, config?.sensitive);
      if (stored?.isOptimistic && stored.previousData !== undefined) {
        await this.set(key, stored.previousData, config);
        return stored.previousData;
      }
      await this.removeEntry(key, config?.sensitive);
      return null;
    } catch (err) {
      this.logError('optimistic', `revertOptimistic failed: ${err}`, key);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async readEntry(key: string, sensitive?: boolean): Promise<StoredCacheEntry | null> {
    try {
      const raw = sensitive
        ? await SecureStore.getItemAsync(key)
        : await AsyncStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as StoredCacheEntry;
    } catch (err) {
      this.logError('corruption', `parse failed: ${err}`, key);
      await this.removeEntry(key, sensitive);
      return null;
    }
  }

  private async writeEntry(key: string, entry: StoredCacheEntry, sensitive: boolean): Promise<void> {
    const value = JSON.stringify(entry);
    if (sensitive) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  }

  private async removeEntry(key: string, sensitive?: boolean): Promise<void> {
    if (sensitive) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  }

  private mergeConfig(config?: Partial<CacheConfig>): CacheConfig {
    const d = CACHE_PRESETS.userSpecific;
    return {
      ttl: config?.ttl ?? d.ttl,
      maxAge: config?.maxAge ?? d.maxAge,
      sensitive: config?.sensitive ?? d.sensitive,
      namespace: config?.namespace ?? d.namespace,
    };
  }

  private miss(): null {
    this.metrics.misses++;
    this.updateHitRate();
    return null;
  }

  private updateHitRate(): void {
    if (this.metrics.totalRequests > 0) {
      this.metrics.hitRate = this.metrics.hits / this.metrics.totalRequests;
    }
  }

  private resetMetrics(): void {
    this.metrics = { hits: 0, misses: 0, totalRequests: 0, hitRate: 0, totalSize: 0, entryCount: 0 };
  }

  private async evictIfNeeded(): Promise<void> {
    const m = await this.getMetrics();
    if (m.totalSize > this.maxCacheSize) await this.evictLRU();
  }

  private logError(type: CacheError['type'], message: string, key?: string): void {
    this.errorLogger.log({ type, message, key, timestamp: Date.now() });
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const cacheManager = new CacheManager();
