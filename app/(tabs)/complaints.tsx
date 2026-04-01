import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, Image, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import BuildingDropdown from '../../components/BuildingDropdown';
import { useBuildings, Building } from '../../hooks/useBuildings';
import { useMarkNotificationsRead } from '../../hooks/useMarkNotificationsRead';

const STATUS_COLORS: Record<string, string> = {
  open: Colors.danger, in_progress: Colors.warning, resolved: Colors.success,
};
const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved',
};

// Helper: format who filed the complaint
function getFiledBy(item: any): string {
  const u = item.users;
  if (!u) return 'Unknown';
  if (u.role === 'admin') return 'Admin';
  if (u.role === 'pramukh') return `Pramukh - ${u.name}`;
  return u.name + (u.flat_no ? ` • Flat ${u.flat_no}` : '');
}

export default function ComplaintsScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canManage = user?.role === 'pramukh' || isAdmin;
  const params = useLocalSearchParams<{ building_id?: string; building_name?: string }>();

  useMarkNotificationsRead(['complaint', 'complaint_update']);

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  // Auto-select building when navigated from admin panel
  useEffect(() => {
    if (params.building_id && params.building_name && isAdmin) {
      setSelectedBuilding({ id: params.building_id, name: params.building_name });
    }
  }, [params.building_id]);

  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [form, setForm] = useState({ title: '', description: '', category: '' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: '', remark: '' });

  const fetchComplaints = async () => {
    try {
      const params = isAdmin && selectedBuilding ? { building_id: selectedBuilding.id } : {};
      const res = await api.get('/complaints', { params });
      setComplaints(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchComplaints(); }, [selectedBuilding]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.3,
      base64: true,
      exif: false,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setPhoto(`data:image/jpeg;base64,${asset.base64}`);
    }
  };

  const submitComplaint = async () => {
    if (!form.title.trim()) return Alert.alert('Error', 'Title is required');
    if (isAdmin && !selectedBuilding) return Alert.alert('Error', 'Please select a building first');
    setSubmitting(true);
    try {
      const payload: any = { ...form };
      if (isAdmin) payload.building_id = selectedBuilding!.id;
      if (photo) payload.photo_url = photo;
      await api.post('/complaints', payload);
      setShowAdd(false);
      setForm({ title: '', description: '', category: '' });
      setPhoto(null);
      fetchComplaints();
      Alert.alert('Success', 'Complaint submitted successfully');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async () => {
    if (!statusForm.status) return Alert.alert('Error', 'Select a status');
    try {
      await api.patch('/complaints/status', { complaint_id: showDetail.id, ...statusForm });
      setShowDetail(null);
      fetchComplaints();
      Alert.alert('Updated', 'Complaint status updated');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to update');
    }
  };

  const deleteComplaint = async (id: string) => {
    Alert.alert('Delete Complaint', 'Are you sure you want to permanently delete this complaint?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/complaints/${id}`);
            setShowDetail(null);
            fetchComplaints();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Failed to delete');
          }
        },
      },
    ]);
  };
  
  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => { setShowDetail(item); setStatusForm({ status: item.status, remark: item.remark || '' }); }}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{STATUS_LABELS[item.status]}</Text>
        </View>
        {item.category && <Text style={styles.category}>{item.category}</Text>}
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      {item.description && <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>}
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>By: {getFiledBy(item)}</Text>
        <Text style={styles.cardMeta}>{new Date(item.created_at).toLocaleDateString('en-IN')}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Complaints</Text>
        {(user?.role === 'user' || user?.role === 'pramukh' || isAdmin) && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={22} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {/* Admin building filter */}
      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown
            buildings={buildings}
            loading={buildingsLoading}
            selected={selectedBuilding}
            onSelect={(b) => setSelectedBuilding(b)}
            label="Filter by Building"
          />
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchComplaints(); }} />}
          ListEmptyComponent={<Text style={styles.empty}>No complaints yet</Text>}
        />
      )}

      {/* Add Complaint Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Complaint</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {isAdmin && (
              <BuildingDropdown
                buildings={buildings}
                loading={buildingsLoading}
                selected={selectedBuilding}
                onSelect={setSelectedBuilding}
              />
            )}
            <Text style={styles.label}>Title *</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="Brief complaint title" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Category</Text>
            <TextInput style={styles.input} value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} placeholder="e.g. Water, Electricity, Lift" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Describe the issue..." multiline placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
              <Ionicons name="camera" size={20} color={Colors.primary} />
              <Text style={styles.photoBtnText}>{photo ? 'Photo Selected ✓' : 'Add Photo'}</Text>
            </TouchableOpacity>
            {photo && <Image source={{ uri: photo }} style={styles.photoPreview} />}
            <TouchableOpacity style={styles.submitBtn} onPress={submitComplaint} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Complaint</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Detail / Manage Modal */}
      <Modal visible={!!showDetail} animationType="slide" presentationStyle="pageSheet">
        {showDetail && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complaint Detail</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {isAdmin && (
                  <TouchableOpacity onPress={() => deleteComplaint(showDetail.id)}>
                    <Ionicons name="trash-outline" size={22} color={Colors.danger} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowDetail(null)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[showDetail.status] + '20', alignSelf: 'flex-start', marginBottom: 12 }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[showDetail.status] }]}>{STATUS_LABELS[showDetail.status]}</Text>
              </View>
              <Text style={styles.detailTitle}>{showDetail.title}</Text>
              {showDetail.category && <Text style={styles.detailMeta}>Category: {showDetail.category}</Text>}
              <Text style={styles.detailMeta}>By: {getFiledBy(showDetail)}</Text>
              <Text style={styles.detailMeta}>Date: {new Date(showDetail.created_at).toLocaleString('en-IN')}</Text>
              {showDetail.description && <Text style={styles.detailDesc}>{showDetail.description}</Text>}
              {showDetail.photo_url && (
                <Image source={{ uri: showDetail.photo_url }} style={styles.detailImage} resizeMode="cover" />
              )}
              {showDetail.remark && (
                <View style={styles.remarkBox}>
                  <Text style={styles.remarkLabel}>Remark:</Text>
                  <Text style={styles.remarkText}>{showDetail.remark}</Text>
                </View>
              )}
              {canManage && (
                <View style={styles.manageSection}>
                  <Text style={styles.label}>Update Status</Text>
                  <View style={styles.statusOptions}>
                    {['open', 'in_progress', 'resolved'].map((s) => (
                      <TouchableOpacity key={s} style={[styles.statusOption, statusForm.status === s && { backgroundColor: STATUS_COLORS[s] }]} onPress={() => setStatusForm({ ...statusForm, status: s })}>
                        <Text style={[styles.statusOptionText, statusForm.status === s && { color: Colors.white }]}>{STATUS_LABELS[s]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.label}>Add Remark</Text>
                  <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={statusForm.remark} onChangeText={(v) => setStatusForm({ ...statusForm, remark: v })} placeholder="Add a comment..." multiline placeholderTextColor={Colors.textMuted} />
                  <TouchableOpacity style={styles.submitBtn} onPress={updateStatus}>
                    <Text style={styles.submitBtnText}>Update Status</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        )}
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  category: { fontSize: 12, color: Colors.textMuted, backgroundColor: Colors.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: Colors.textMuted, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardMeta: { fontSize: 12, color: Colors.textMuted },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 60, fontSize: 16 },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, padding: 12, marginTop: 12 },
  photoBtnText: { color: Colors.primary, fontWeight: '600' },
  photoPreview: { width: '100%', height: 180, borderRadius: 10, marginTop: 10 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  detailTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  detailMeta: { fontSize: 13, color: Colors.textMuted, marginBottom: 4 },
  detailDesc: { fontSize: 15, color: Colors.text, marginTop: 12, lineHeight: 22 },
  detailImage: { width: '100%', height: 200, borderRadius: 12, marginTop: 14 },
  remarkBox: { backgroundColor: Colors.bg, borderRadius: 10, padding: 12, marginTop: 16 },
  remarkLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 4 },
  remarkText: { fontSize: 14, color: Colors.text },
  manageSection: { marginTop: 24, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16 },
  statusOptions: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statusOption: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 8, padding: 10, alignItems: 'center' },
  statusOptionText: { fontSize: 12, fontWeight: '600', color: Colors.text },
});
