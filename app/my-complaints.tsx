import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../constants/colors';
import api from '../utils/api';

const STATUS_COLOR: Record<string, string> = {
  open: '#F59E0B',
  in_progress: Colors.primary,
  resolved: Colors.success,
  closed: Colors.textMuted,
};

const CATEGORIES = ['General', 'Maintenance', 'Noise', 'Cleanliness', 'Security', 'Water', 'Electricity', 'Other'];

export default function MyComplaintsScreen() {
  const router = useRouter();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'General' });
  const [submitting, setSubmitting] = useState(false);

  const fetch = async () => {
    try {
      const res = await api.get('/complaints?mine=true');
      setComplaints(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetch(); }, []));

  const submit = async () => {
    if (!form.title.trim()) return Alert.alert('Error', 'Title is required');
    if (!form.description.trim()) return Alert.alert('Error', 'Description is required');
    setSubmitting(true);
    try {
      await api.post('/complaints', {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
      });
      setShowAdd(false);
      setForm({ title: '', description: '', category: 'General' });
      fetch();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Complaints</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={s.addBtn}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={i => i.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📋</Text>
              <Text style={s.emptyTitle}>No complaints yet</Text>
              <Text style={s.emptyText}>Tap + to raise a complaint</Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = STATUS_COLOR[item.status] || Colors.textMuted;
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{item.title}</Text>
                    <Text style={s.cardCat}>{item.category}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: color + '20' }]}>
                    <Text style={[s.statusText, { color }]}>{item.status?.replace('_', ' ').toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
                {item.remark ? (
                  <View style={s.remarkRow}>
                    <Ionicons name="chatbox-ellipses-outline" size={13} color={Colors.primary} />
                    <Text style={s.remarkText}>{item.remark}</Text>
                  </View>
                ) : null}
                <Text style={s.cardDate}>{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
            );
          }}
        />
      )}

      {/* Add Complaint Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>New Complaint</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Title *</Text>
            <TextInput
              style={s.input}
              value={form.title}
              onChangeText={v => setForm({ ...form, title: v })}
              placeholder="Brief title of your complaint"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={s.label}>Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={s.catRow}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[s.catChip, form.category === c && s.catChipActive]}
                    onPress={() => setForm({ ...form, category: c })}
                  >
                    <Text style={[s.catChipText, form.category === c && { color: Colors.white }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={s.label}>Description *</Text>
            <TextInput
              style={[s.input, { height: 100, textAlignVertical: 'top' }]}
              value={form.description}
              onChangeText={v => setForm({ ...form, description: v })}
              placeholder="Describe the issue in detail..."
              placeholderTextColor={Colors.textMuted}
              multiline
            />
            <TouchableOpacity style={s.submitBtn} onPress={submit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Submit Complaint</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  list: { padding: 16 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardCat: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '800' },
  cardDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  remarkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: Colors.primary + '10', borderRadius: 8, padding: 8 },
  remarkText: { fontSize: 12, color: Colors.primary, fontWeight: '600', flex: 1 },
  cardDate: { fontSize: 11, color: Colors.border, marginTop: 8 },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  catRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  catChip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 28, marginBottom: 30 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
