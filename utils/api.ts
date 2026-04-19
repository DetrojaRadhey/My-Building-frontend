import axios, { InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/api';
import { cacheManager, CACHE_PRESETS, CacheConfig } from './CacheManager';

// Extend Axios config to carry cache metadata
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _cacheKey?: string;
    _cacheConfig?: Partial<CacheConfig>;
    _skipCache?: boolean;
    _module?: string;
  }
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Registered by AuthContext so the interceptor can trigger logout
let _onAuthFailure: (() => void) | null = null;
export function registerAuthFailureHandler(fn: () => void) {
  _onAuthFailure = fn;
}

// ── Request interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

// ── Response interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  async (response) => {
    const config = response.config;
    const method = config.method?.toLowerCase();

    // Cache successful GET responses
    if (method === 'get' && !config._skipCache) {
      const module = config._module ?? deriveModule(config.url ?? '');
      const cacheKey = config._cacheKey ?? cacheManager.generateKey(module, config.url ?? '', config.params);
      const cacheConfig = config._cacheConfig ?? guessCacheConfig(config.url ?? '');
      await cacheManager.set(cacheKey, response.data, cacheConfig);
    }

    // Invalidate cache on mutations
    if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
      const module = config._module ?? deriveModule(config.url ?? '');
      await cacheManager.invalidate(`${module}:*`);
    }

    return response;
  },
  async (error) => {
    const status = error.response?.status;

    // Token missing, invalid or expired — force logout
    if (status === 401 || (status === 403 && !error.response?.data?.error)) {
      await AsyncStorage.multiRemove(['token', 'user', 'subscription']);
      _onAuthFailure?.();
      return Promise.reject({ _authError: true });
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('[API] Network error — is the backend running at', API_BASE, '?');
    } else if (status === 404 && error.response?.data?.error === 'not_available') {
      // Expected — no newspaper uploaded for this date
    } else {
      console.error('[API] Error:', status, error.response?.data);
    }
    return Promise.reject(error);
  },
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Derive module name from URL path (e.g. /api/maintenance/bills → maintenance) */
function deriveModule(url: string): string {
  const parts = url.replace(/^\/+/, '').split('/');
  // Skip 'api' prefix if present
  const start = parts[0] === 'api' ? 1 : 0;
  return parts[start] ?? 'default';
}

/** Pick a cache preset based on URL patterns */
function guessCacheConfig(url: string): Partial<CacheConfig> {
  if (/\/(bills|payments|transactions)/.test(url)) return CACHE_PRESETS.userSpecific;
  if (/\/(building|society|rules|settings)/.test(url)) return CACHE_PRESETS.static;
  return CACHE_PRESETS.buildingWide;
}

export default api;
