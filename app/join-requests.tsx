import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../utils/api';
import { useMarkNotificationsRead } from '../hooks/useMarkNotificationsRead';

export default function JoinRequestsScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [handlingId, setHandlingId] = useState<string | null>(null);

  useMarkNotificationsRead(['join_request', 'join_response']);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/buildings/join/pending');
      setRequests(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleRequest = async (request_id: string, action: 'approve' | 'reject') => {
    setHandlingId(request_id + action);
    try {
      await api.post('/buildings/join/handle', { request_id, action });
      Alert.alert('Done', `Request ${action}d`);
      fetchRequests();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally {
      setHandlingId(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.users?.name?.[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.users?.name}</Text>
          <Text style={styles.cardEmail}>{item.users?.email}</Text>
          {item.users?.phone ? <Text style={styles.cardEmail}>{item.users.phone}</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.approveBtn]}
          onPress={() => handleRequest(item.id, 'approve')}
          disabled={!!handlingId}
        >
          {handlingId === item.id + 'approve'
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <><Ionicons name="checkmark" size={18} color={Colors.white} /><Text style={styles.btnText}>{t('approve')}</Text></>
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.rejectBtn]}
          onPress={() => handleRequest(item.id, 'reject')}
          disabled={!!handlingId}
        >
          {handlingId === item.id + 'reject'
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <><Ionicons name="close" size={18} color={Colors.white} /><Text style={styles.btnText}>{t('reject')}</Text></>
          }
        </TouchableOpacity>
      </View>
    </View>
  );

  

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('joinRequestsTitle')}</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No pending join requests</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardEmail: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 11 },
  approveBtn: { backgroundColor: Colors.success },
  rejectBtn: { backgroundColor: Colors.danger },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 16, color: Colors.textMuted },
});
