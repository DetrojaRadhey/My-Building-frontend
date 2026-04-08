import React, { useEffect, useState } from 'react';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, ScrollView, Alert, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../utils/api';

export default function SubscriptionsAdminScreen() {
  const PLAN_COLOR: Record<string, string> = { monthly: Colors.primary, yearly: '#F59E0B', lifetime: Colors.success };
  const STATUS_COLOR: Record<string, string> = { active: Colors.success, expired: Colors.warning, cancelled: Colors.danger };
  const router = useRouter();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [acting, setActing] = useState(false);
  const [remark, setRemark] = useState('');

  const fetchData = async () => {
    try {
      const res = await api.get('/subscriptions/all');
      setSubs(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const grant = async (user_id: string, plan: string) => {
    setActing(true);
    try {
      await api.post('/subscriptions/grant', { user_id, plan, remark: remark.trim() || undefined });
      setSelected(null);
      setRemark('');
      fetchData();
      Alert.alert('Done', `${plan} subscription granted`);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setActing(false); }
  };

  const revoke = async (user_id: string) => {
    Alert.alert('Revoke', 'Cancel this subscription?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        setActing(true);
        try {
          await api.post('/subscriptions/revoke', { user_id });
          setSelected(null);
          setRemark('');
          fetchData();
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.error || 'Failed');
        } finally { setActing(false); }
      }},
    ]);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => { setSelected(item); setRemark(''); }}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.users?.name?.[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.users?.name}</Text>
          <Text style={styles.cardEmail}>{item.users?.email}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[styles.badge, { backgroundColor: PLAN_COLOR[item.plan] + '20' }]}>
            <Text style={[styles.badgeText, { color: PLAN_COLOR[item.plan] }]}>{item.plan.toUpperCase()}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.cardMeta}>
        Started: {new Date(item.started_at).toLocaleDateString('en-IN')}
        {item.expires_at ? `  ·  Expires: ${new Date(item.expires_at).toLocaleDateString('en-IN')}` : '  ·  Lifetime'}
      </Text>
      {item.paid_amount != null && (
        <View style={styles.paidRow}>
          <Text style={styles.paidAmt}>₹{Number(item.paid_amount).toLocaleString('en-IN')} paid</Text>
          {item.promo_code_used && (
            <View style={styles.promoChip}>
              <Ionicons name="pricetag-outline" size={11} color="#7C3AED" />
              <Text style={styles.promoChipText}>{item.promo_code_used}</Text>
            </View>
          )}
        </View>
      )}
      {item.remark ? (
        <View style={styles.remarkChip}>
          <Ionicons name="chatbox-ellipses-outline" size={12} color="#7C3AED" />
          <Text style={styles.remarkChipText} numberOfLines={1}>{item.remark}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscriptions</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.statsRow}>
        {[
          { label: 'Total', count: subs.length, color: Colors.primary },
          { label: 'Active', count: subs.filter(s => s.status === 'active').length, color: Colors.success },
          { label: 'Expired', count: subs.filter(s => s.status === 'expired').length, color: Colors.warning },
          { label: 'Lifetime', count: subs.filter(s => s.plan === 'lifetime').length, color: Colors.accent },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={subs}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          ListEmptyComponent={<Text style={styles.empty}>No subscriptions yet</Text>}
        />
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected.users?.name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                ['Email', selected.users?.email],
                ['Role', selected.users?.role],
                ['Plan', selected.plan],
                ['Status', selected.status],
                ['Paid Amount', selected.paid_amount != null ? `₹${Number(selected.paid_amount).toLocaleString('en-IN')}` : '—'],
                ['Promo Used', selected.promo_code_used || '—'],
                ['Started', new Date(selected.started_at).toLocaleString('en-IN')],
                ['Expires', selected.expires_at ? new Date(selected.expires_at).toLocaleString('en-IN') : 'Never (Lifetime)'],
                ['Payment ID', selected.razorpay_payment_id || '—'],
              ].map(([k, v]) => (
                <View key={k as string} style={styles.detailRow}>
                  <Text style={styles.detailKey}>{k as string}</Text>
                  <Text style={styles.detailVal}>{v as string}</Text>
                </View>
              ))}

              {/* Existing remark */}
              {selected.remark ? (
                <View style={styles.existingRemark}>
                  <Ionicons name="chatbox-ellipses" size={14} color="#7C3AED" />
                  <Text style={styles.existingRemarkText}>{selected.remark}</Text>
                </View>
              ) : null}

              <Text style={styles.sectionLabel}>Remark <Text style={styles.optionalLabel}>(optional)</Text></Text>
              <TextInput
                style={styles.remarkInput}
                value={remark}
                onChangeText={setRemark}
                placeholder="e.g. Cash collected by Ravi on 01 Apr"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={300}
              />
              <Text style={styles.charCount}>{remark.length}/300</Text>

              <Text style={styles.sectionLabel}>Grant Subscription</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary }]} onPress={() => grant(selected.user_id, 'monthly')} disabled={acting}>
                  <Text style={styles.actionBtnText}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]} onPress={() => grant(selected.user_id, 'yearly')} disabled={acting}>
                  <Text style={styles.actionBtnText}>Yearly</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success }]} onPress={() => grant(selected.user_id, 'lifetime')} disabled={acting}>
                  <Text style={styles.actionBtnText}>Lifetime</Text>
                </TouchableOpacity>
              </View>
              {selected.status === 'active' && (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.danger, marginTop: 8 }]} onPress={() => revoke(selected.user_id)} disabled={acting}>
                  <Text style={styles.actionBtnText}>Revoke Subscription</Text>
                </TouchableOpacity>
              )}
              {acting && <ActivityIndicator style={{ marginTop: 12 }} color={Colors.primary} />}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  statsRow: { flexDirection: 'row', padding: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statCount: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardEmail: { fontSize: 12, color: Colors.textMuted },
  cardMeta: { fontSize: 12, color: Colors.textMuted },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 60, fontSize: 15 },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailKey: { fontSize: 13, color: Colors.textMuted },
  detailVal: { fontSize: 13, fontWeight: '600', color: Colors.text, maxWidth: '60%', textAlign: 'right' },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  actionBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  paidAmt: { fontSize: 13, fontWeight: '700', color: Colors.success },
  promoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F3FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  promoChipText: { fontSize: 11, color: '#7C3AED', fontWeight: '700' },
  // Remark
  remarkChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, backgroundColor: '#F5F3FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  remarkChipText: { fontSize: 12, color: '#7C3AED', fontWeight: '600', maxWidth: 260 },
  existingRemark: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F5F3FF', borderRadius: 10, padding: 12, marginTop: 12 },
  existingRemarkText: { fontSize: 13, color: '#7C3AED', fontWeight: '600', flex: 1 },
  optionalLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  remarkInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, backgroundColor: Colors.bg, minHeight: 72, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 4, marginBottom: 4 },
});
