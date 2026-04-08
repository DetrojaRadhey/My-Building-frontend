import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { API_BASE } from '../constants/api';
import { registerAuthFailureHandler } from '../utils/api';

type User = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'pramukh' | 'admin' | 'watchman';
  building_id?: string;
  flat_no?: string;
  phone?: string;
  wing?: string;
  total_members?: number;
};

type Subscription = {
  plan: 'monthly' | 'yearly' | 'lifetime';
  status: 'active' | 'expired' | 'cancelled';
  expires_at: string | null;
} | null;

type AuthContextType = {
  user: User | null;
  token: string | null;
  subscription: Subscription;
  hasActiveSubscription: boolean;
  login: (token: string, user: User, subscription?: Subscription) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription>(null);

  const isSubActive = (sub: Subscription) => {
    if (!sub || sub.status !== 'active') return false;
    if (sub.plan === 'lifetime') return true;
    return !sub.expires_at || new Date(sub.expires_at) > new Date();
  };

  const fetchSubscription = async (t: string) => {
    try {
      const res = await axios.get(`${API_BASE}/subscriptions/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const sub = res.data as Subscription;
      setSubscription(sub);
      await AsyncStorage.setItem('subscription', JSON.stringify(sub));
    } catch {
      // keep cached value on network error
    }
  };

  useEffect(() => {
    AsyncStorage.multiGet(['token', 'user', 'subscription']).then(([t, u, s]) => {
      if (t[1] && u[1]) {
        setToken(t[1]);
        setUser(JSON.parse(u[1]));
        // Load cached subscription instantly — no flicker
        if (s[1]) setSubscription(JSON.parse(s[1]));
        // Then refresh in background
        fetchSubscription(t[1]);
      }
      setLoading(false);
    });
  }, []);

  const login = async (t: string, u: User, sub?: Subscription) => {
    // If subscription came with the login response, cache it immediately — no extra round trip
    const resolvedSub = sub !== undefined ? sub : null;
    await AsyncStorage.multiSet([
      ['token', t],
      ['user', JSON.stringify(u)],
      ['subscription', JSON.stringify(resolvedSub)],
    ]);
    setToken(t);
    setUser(u);
    setSubscription(resolvedSub);

    // Refresh subscription in background only if it wasn't provided
    if (sub === undefined) fetchSubscription(t);

    registerPushToken(t);
  };

  const registerPushToken = async (t: string) => {
    try {
      if (!Device.isDevice) return;
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default', importance: Notifications.AndroidImportance.MAX,
        });
      }
      const tokenData = await Notifications.getExpoPushTokenAsync();
      await axios.post(`${API_BASE}/auth/push-token`, { expo_push_token: tokenData.data }, {
        headers: { Authorization: `Bearer ${t}` },
      });
    } catch {
      // silently fail — push is non-critical
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'user', 'subscription']);
    setToken(null);
    setUser(null);
    setSubscription(null);
  };

  // Wire up the API interceptor so 401/403 auto-triggers logout
  useEffect(() => {
    registerAuthFailureHandler(() => {
      setToken(null);
      setUser(null);
      setSubscription(null);
    });
  }, []);

  const refreshSubscription = async () => {
    const t = token || (await AsyncStorage.getItem('token'));
    if (t) await fetchSubscription(t);
  };

  const refreshUser = async () => {
    try {
      const storedToken = token || (await AsyncStorage.getItem('token'));
      if (!storedToken) return;
      const res = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      const updated = res.data.user as User;
      await AsyncStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{
      user, token, subscription,
      hasActiveSubscription: user?.role === 'admin' || isSubActive(subscription),
      login, logout, refreshUser, refreshSubscription, loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
