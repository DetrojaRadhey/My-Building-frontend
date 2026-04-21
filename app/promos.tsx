import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../constants/colors';
import api from '../utils/api';

type Promo = {
  id: string; code: string; type: 'percent' | 'flat';
  value: number; description: string | null;
  expires_at: string | null; is_used: boolean;
  used_at: string | null;
  used_by_user?: { name: string; email: string } | null;
  created_at: string;
};

export default function PromosScreen() {
  const router = useRouter();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: 'percent', value: '', description: '', expires_at: '', prefix: '',
  });
  const [tab, setTab] = useState<'active' | 'used'>('active');

  const fetch = async () => {
    try {
      const res = await api.get('/promos');
      setPromos(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetch(); }, []));

  const create = async () => {
    if (!form.value) return Alert.alert('Error', 'Value is required');
    setSubmitting(true);
    try {
      await api.post('/promos', {
        type: form.type,
        value: parseFloat(form.value),
        description: form.description || undefined,
        expires_at: form.expires_at || undefined,
        prefix: form.prefix || undefined,
      });
      setShowCreate(false);
      setForm({ type: 'percent', value: '', description: '', expires_at: '', prefix: '' });
      fetch();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  const deletePromo = (id: string, code: string) => {
    Alert.alert('Delete', `Delete promo code ${code}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/promos/${id}`);
          setPromos(prev => prev.filter(p => p.id !== id));
        } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
      }},
    ]);
  };

  const shareCode = (code: string, type: string, value: number) => {
    const label = type === 'percent' ? `${value}% off` : `₹${value} off`;
    Share.share({ message: `Use code ${code} to get ${label} on My Building subscription!` });
  };

  const active = promos.filter(p => !p.is_used);
  const used   = promos.filter(p => p.is_used);
  const displayed = tab === 'active' ? active : used;

  const renderItem = ({ item }: { item: Promo }) => {
    const label = item.type === 'percent' ? `${item.value}% OFF` : `₹${item.value} OFF`;
    const color = item.type === 'percent' ? '#7C3AED' : Colors.primary;
    return (
      <View style={[styles.card, item.is_used && styles.cardUsed]}>
        <View style={styles.cardLeft}>
          <View style={[styles.discountBadge, { backgroundColor: color + '18' }]}>
            <Text style={[styles.discountText, { color }]}>{label}</Text>
          </View>
          <Text style={styles.code}>{item.code}</Text>
          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          {item.expires_at ? (
            <Text style={styles.meta}>Expires: {new Date(item.expires_at).toLocaleDateString('en-IN')}</Text>
          ) : (
            <Text style={styles.meta}>No expiry</Text>
          )}
          {item.is_used && item.used_by_user ? (
            <View style={styles.usedRow}>
              <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
              <Text style={styles.usedText}>
                Used by {item.used_by_user.name} · {new Date(item.used_at!).toLocaleDateString('en-IN')}
              </Text>
            </View>
          ) : null}
        </View>
        {!item.is_used && (
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => shareCode(item.code, item.type, item.value)}>
              <Ionicons name="share-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => deletePromo(item.id, item.code)}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promo Codes</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: Colors.primary }]}>{active.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: Colors.success }]}>{used.length}</Text>
          <Text style={styles.statLabel}>Used</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: Colors.text }]}>{promos.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab === 'active' && styles.tabActive]} onPress={() => setTab('active')}>
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>Active ({active.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'used' && styles.tabActive]} onPress={() => setTab('used')}>
          <Text style={[styles.tabText, tab === 'used' && styles.tabTextActive]}>Used History ({used.length})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="pricetag-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyText}>{tab === 'active' ? 'No active promo codes' : 'No used codes yet'}</Text>
            </View>
          }
        />
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Promo Code</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Discount Type *</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, form.type === 'percent' && styles.typeBtnActive]}
                onPress={() => setForm({ ...form, type: 'percent' })}
              >
                <Text style={[styles.typeBtnText, form.type === 'percent' && { color: Colors.white }]}>% Percentage</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, form.type === 'flat' && styles.typeBtnActive]}
                onPress={() => setForm({ ...form, type: 'flat' })}
              >
                <Text style={[styles.typeBtnText, form.type === 'flat' && { color: Colors.white }]}>₹ Flat Amount</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>
              {form.type === 'percent' ? 'Discount % *' : 'Discount Amount (₹) *'}
            </Text>
            <TextInput style={styles.input} value={form.value} onChangeText={v => setForm({ ...form, value: v })}
              placeholder={form.type === 'percent' ? 'e.g. 20' : 'e.g. 50'}
              keyboardType="numeric" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Code Prefix (optional)</Text>
            <TextInput style={styles.input} value={form.prefix} onChangeText={v => setForm({ ...form, prefix: v.toUpperCase() })}
              placeholder="e.g. SAVE → SAVE-A1B2C3" autoCapitalize="characters"
              placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput style={styles.input} value={form.description} onChangeText={v => setForm({ ...form, description: v })}
              placeholder="e.g. New year offer" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Expiry Date (optional, YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={form.expires_at} onChangeText={v => setForm({ ...form, expires_at: v })}
              placeholder="e.g. 2026-12-31" placeholderTextColor={Colors.textMuted} />

            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Preview</Text>
              <Text style={styles.previewCode}>
                {form.prefix ? `${form.prefix}-XXXXXX` : 'XXXXXX'}
              </Text>
              <Text style={styles.previewDiscount}>
                {form.value
                  ? form.type === 'percent' ? `${form.value}% off` : `₹${form.value} off`
                  : 'Enter value above'}
              </Text>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={create} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Generate Code</Text>}
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  addBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 },
  statsRow: { flexDirection: 'row', padding: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: '800' },
  list: { padding: 16 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardUsed: { opacity: 0.65 },
  cardLeft: { flex: 1 },
  discountBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  discountText: { fontSize: 13, fontWeight: '800' },
  code: { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: 2, marginBottom: 4 },
  desc: { fontSize: 13, color: Colors.textMuted, marginBottom: 4 },
  meta: { fontSize: 12, color: Colors.border },
  usedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  usedText: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  cardActions: { gap: 8, marginLeft: 8 },
  actionBtn: { padding: 6 },
  empty: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { fontSize: 15, color: Colors.textMuted, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 13, alignItems: 'center' },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  previewBox: { backgroundColor: Colors.bg, borderRadius: 12, padding: 16, marginTop: 20, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' },
  previewLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginBottom: 6 },
  previewCode: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: 3 },
  previewDiscount: { fontSize: 14, color: Colors.primary, fontWeight: '700', marginTop: 4 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
