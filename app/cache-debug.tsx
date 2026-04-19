import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { cacheManager, CacheMetrics, CacheError } from '../utils/CacheManager';

// Only accessible in development mode
export default function CacheDebugScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<CacheMetrics | null>(null);
  const [errors, setErrors] = useState<CacheError[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const m = await cacheManager.getMetrics();
    setMetrics(m);
    setErrors(cacheManager.getErrorLogger().getRecentErrors(20));
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleClearAll = () => {
    Alert.alert('Clear Cache', 'Clear all cached data?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await cacheManager.clear();
        await refresh();
        Alert.alert('Done', 'Cache cleared');
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛠 Cache Debug</Text>
        <TouchableOpacity onPress={refresh} style={styles.backBtn}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Metrics */}
          <Text style={styles.sectionTitle}>Metrics</Text>
          <View style={styles.card}>
            {metrics && [
              ['Hit Rate', `${(metrics.hitRate * 100).toFixed(1)}%`],
              ['Hits', String(metrics.hits)],
              ['Misses', String(metrics.misses)],
              ['Total Requests', String(metrics.totalRequests)],
              ['Entry Count', String(metrics.entryCount)],
              ['Est. Size', `${(metrics.totalSize / 1024).toFixed(1)} KB`],
            ].map(([label, value]) => (
              <View key={label} style={styles.row}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{value}</Text>
              </View>
            ))}
          </View>

          {/* Actions */}
          <Text style={styles.sectionTitle}>Actions</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.dangerBtnText}>Clear All Cache</Text>
          </TouchableOpacity>

          {/* Recent Errors */}
          <Text style={styles.sectionTitle}>Recent Errors ({errors.length})</Text>
          {errors.length === 0 ? (
            <Text style={styles.noErrors}>No errors logged</Text>
          ) : (
            errors.map((e, i) => (
              <View key={i} style={styles.errorCard}>
                <Text style={styles.errorType}>{e.type.toUpperCase()}</Text>
                <Text style={styles.errorMsg}>{e.message}</Text>
                {e.key && <Text style={styles.errorKey}>Key: {e.key}</Text>}
                <Text style={styles.errorTime}>{new Date(e.timestamp).toLocaleTimeString()}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  content: { padding: 16, gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: Colors.text },
  rowValue: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.danger, borderRadius: 12, padding: 14, justifyContent: 'center' },
  dangerBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  noErrors: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8 },
  errorCard: { backgroundColor: Colors.white, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: Colors.danger, gap: 3 },
  errorType: { fontSize: 11, fontWeight: '800', color: Colors.danger },
  errorMsg: { fontSize: 13, color: Colors.text },
  errorKey: { fontSize: 11, color: Colors.textMuted },
  errorTime: { fontSize: 11, color: Colors.textMuted },
});
