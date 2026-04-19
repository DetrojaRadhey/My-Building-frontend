import React, { useCallback, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useMarkNotificationsRead } from '../hooks/useMarkNotificationsRead';
import { useActivityLog } from '../hooks/useActivityLog';
import { useBuildings, Building } from '../hooks/useBuildings';
import BuildingDropdown from '../components/BuildingDropdown';
import { cacheManager, CACHE_PRESETS } from '../utils/CacheManager';

type BillingCategory = 'maintenance' | 'water_meter' | 'special';

const CATEGORIES: Array<{
  category: BillingCategory;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bg: string;
}> = [
  {
    category: 'maintenance',
    title: 'Maintenance Bill',
    subtitle: 'Monthly society charges',
    icon: 'construct-outline',
    color: '#3B5FC0',
    bg: '#E8EEF9',
  },
  {
    category: 'water_meter',
    title: 'Water Meter',
    subtitle: 'Per-flat water charges',
    icon: 'water-outline',
    color: '#0D9488',
    bg: '#E0F7F4',
  },
  {
    category: 'special',
    title: 'Special Bills',
    subtitle: 'Ad-hoc or one-time charges',
    icon: 'receipt-outline',
    color: '#7C3AED',
    bg: '#EDE9FE',
  },
];

export default function MaintenanceScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();
  const { logEvent } = useActivityLog();
  const isAdmin = user?.role === 'admin';

  useMarkNotificationsRead(['bill', 'payment', 'reminder']);

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  const [pendingCounts, setPendingCounts] = useState<Record<BillingCategory, number>>({
    maintenance: 0, water_meter: 0, special: 0,
  });
  const [loading, setLoading] = useState(!isAdmin); // admin waits for building selection
  const [refreshing, setRefreshing] = useState(false);

  const fetchPendingCounts = useCallback(async (forceRefresh = false) => {
    // Admin must select a building first
    if (isAdmin && !selectedBuilding) return;

    const cacheKey = cacheManager.generateKey(
      'maintenance', '/maintenance/payments',
      { mine: 'true', building_id: selectedBuilding?.id },
      user?.role, selectedBuilding?.id,
    );

    // Show cached data instantly on first load
    if (!forceRefresh) {
      const cached = await cacheManager.get<any[]>(cacheKey, CACHE_PRESETS.userSpecific);
      if (cached) {
        const counts: Record<BillingCategory, number> = { maintenance: 0, water_meter: 0, special: 0 };
        for (const p of cached) {
          if (p.status === 'pending') {
            const cat = (p.category || p.maintenance_bills?.category || 'maintenance') as BillingCategory;
            if (cat in counts) counts[cat]++;
          }
        }
        setPendingCounts(counts);
        setLoading(false);
      }
    }

    try {
      const params: any = { mine: 'true' };
      if (isAdmin && selectedBuilding) params.building_id = selectedBuilding.id;
      const res = await api.get('/maintenance/payments', { params });
      await cacheManager.set(cacheKey, res.data, CACHE_PRESETS.userSpecific);
      const counts: Record<BillingCategory, number> = { maintenance: 0, water_meter: 0, special: 0 };
      for (const p of res.data) {
        if (p.status === 'pending') {
          const cat = (p.category || p.maintenance_bills?.category || 'maintenance') as BillingCategory;
          if (cat in counts) counts[cat]++;
        }
      }
      setPendingCounts(counts);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [isAdmin, selectedBuilding, user?.role]);

  useFocusEffect(useCallback(() => {
    if (!isAdmin) {
      setLoading(true);
      fetchPendingCounts();
    }
    logEvent('open_maintenance', 'maintenance');
  }, [selectedBuilding]));

  // When admin selects a building, fetch counts
  const handleBuildingSelect = (b: Building) => {
    setSelectedBuilding(b);
    setLoading(true);
    setPendingCounts({ maintenance: 0, water_meter: 0, special: 0 });
  };

  // Trigger fetch when selectedBuilding changes
  React.useEffect(() => {
    if (isAdmin && selectedBuilding) {
      fetchPendingCounts();
    }
  }, [selectedBuilding]);

  const navigate = (category: BillingCategory) => {
    if (isAdmin && !selectedBuilding) return;
    router.push({
      pathname: '/maintenance-category',
      params: {
        category,
        building_id: selectedBuilding?.id ?? '',
        building_name: selectedBuilding?.name ?? '',
      },
    } as any);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('maintenance')}</Text>
          <Text style={styles.headerSub}>
            {isAdmin ? (selectedBuilding ? selectedBuilding.name : 'Select a society') : 'Select a billing category'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await cacheManager.invalidate('maintenance:*');
          fetchPendingCounts(true);
        }} />}
      >
        {/* Admin: building dropdown */}
        {isAdmin && (
          <View style={styles.dropdownWrapper}>
            <BuildingDropdown
              buildings={buildings}
              loading={buildingsLoading}
              selected={selectedBuilding}
              onSelect={handleBuildingSelect}
              label="Select Society"
            />
          </View>
        )}

        {/* Category cards — shown after building selected (or always for non-admin) */}
        {(!isAdmin || selectedBuilding) && (
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
          ) : (
            CATEGORIES.map(cat => {
              const pending = !isAdmin ? pendingCounts[cat.category] : 0;
              return (
                <TouchableOpacity
                  key={cat.category}
                  style={styles.card}
                  onPress={() => navigate(cat.category)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconCircle, { backgroundColor: cat.bg }]}>
                    <Ionicons name={cat.icon as any} size={30} color={cat.color} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{cat.title}</Text>
                    <Text style={styles.cardSub}>{cat.subtitle}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    {pending > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{pending}</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={20} color={Colors.border} />
                  </View>
                </TouchableOpacity>
              );
            })
          )
        )}

        {/* Admin: prompt to select building */}
        {isAdmin && !selectedBuilding && !buildingsLoading && (
          <View style={styles.selectPrompt}>
            <Ionicons name="business-outline" size={52} color={Colors.border} />
            <Text style={styles.selectPromptText}>Select a society above to manage its maintenance bills</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3 },
  content: { padding: 20, gap: 14 },
  dropdownWrapper: { marginBottom: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.white, borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  iconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  cardSub: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    backgroundColor: Colors.danger, borderRadius: 12,
    minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  badgeText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  selectPrompt: { alignItems: 'center', marginTop: 40, gap: 12 },
  selectPromptText: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});

