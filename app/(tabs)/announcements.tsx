import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import BuildingDropdown from '../../components/BuildingDropdown';
import { useBuildings, Building } from '../../hooks/useBuildings';
import { useMarkNotificationsRead } from '../../hooks/useMarkNotificationsRead';

export default function AnnouncementsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useMarkNotificationsRead(['announcement']);
  const canPost = user?.role === 'pramukh' || isAdmin;
  const params = useLocalSearchParams<{ building_id?: string; building_name?: string }>();

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  useEffect(() => {
    if (params.building_id && params.building_name && isAdmin) {
      setSelectedBuilding({ id: params.building_id, name: params.building_name });
    }
  }, [params.building_id]);

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', priority: 'normal' });
  const [submitting, setSubmitting] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      const params = isAdmin && selectedBuilding ? { building_id: selectedBuilding.id } : {};
      const res = await api.get('/announcements', { params });
      setAnnouncements(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAnnouncements(); }, [selectedBuilding]);

  const postAnnouncement = async () => {
    if (!form.title.trim() || !form.body.trim()) return Alert.alert('Error', 'Title and body are required');
    if (isAdmin && !selectedBuilding) return Alert.alert('Error', 'Please select a building first');
    setSubmitting(true);
    try {
      const payload: any = { ...form };
      if (isAdmin) payload.building_id = selectedBuilding!.id;
      await api.post('/announcements', payload);
      setShowAdd(false);
      setForm({ title: '', body: '', priority: 'normal' });
      fetchAnnouncements();
      Alert.alert('Posted', 'Announcement posted and members notified');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to post');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, item.priority === 'urgent' && styles.urgentCard]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{item.priority === 'urgent' ? '🚨' : '📢'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardMeta}>
            {item.users?.name} • {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        {item.priority === 'urgent' && (
          <View style={styles.urgentBadge}><Text style={styles.urgentBadgeText}>URGENT</Text></View>
        )}
      </View>
      <Text style={styles.cardBody}>{item.body}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Announcements</Text>
        {canPost && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={22} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown buildings={buildings} loading={buildingsLoading} selected={selectedBuilding} onSelect={setSelectedBuilding} label="Filter by Building" />
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAnnouncements(); }} />}
          ListEmptyComponent={<Text style={styles.empty}>No announcements yet</Text>}
        />
      )}

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Announcement</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {isAdmin && (
              <BuildingDropdown buildings={buildings} loading={buildingsLoading} selected={selectedBuilding} onSelect={setSelectedBuilding} />
            )}
            <Text style={styles.label}>Title *</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="Announcement title" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Message *</Text>
            <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top' }]} value={form.body} onChangeText={(v) => setForm({ ...form, body: v })} placeholder="Write your announcement..." multiline placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityRow}>
              {['normal', 'urgent'].map((p) => (
                <TouchableOpacity key={p} style={[styles.priorityBtn, form.priority === p && styles.priorityBtnActive]} onPress={() => setForm({ ...form, priority: p })}>
                  <Text style={[styles.priorityBtnText, form.priority === p && styles.priorityBtnTextActive]}>
                    {p === 'urgent' ? '🚨 Urgent' : '📢 Normal'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={postAnnouncement} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Post Announcement</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 8 },
  filterBar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  urgentCard: { borderLeftWidth: 4, borderLeftColor: Colors.danger },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cardIcon: { fontSize: 22 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  urgentBadge: { backgroundColor: Colors.danger, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  urgentBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  cardBody: { fontSize: 14, color: Colors.text, lineHeight: 22 },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 60, fontSize: 16 },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  priorityRow: { flexDirection: 'row', gap: 12 },
  priorityBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  priorityBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  priorityBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  priorityBtnTextActive: { color: Colors.white },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
