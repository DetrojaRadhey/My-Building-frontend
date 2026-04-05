import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const CATEGORIES = ['General', 'Water', 'Electricity', 'Cleanliness', 'Security', 'Parking', 'Noise', 'Other'];

const CAT_ICONS: Record<string, string> = {
  General: 'alert-circle-outline',
  Water: 'water-outline',
  Electricity: 'flash-outline',
  Cleanliness: 'trash-outline',
  Security: 'shield-outline',
  Parking: 'car-outline',
  Noise: 'volume-high-outline',
  Other: 'ellipsis-horizontal-circle-outline',
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  open:        { label: 'Open',        color: '#EF4444', bg: '#FEF2F2', icon: 'alert-circle' },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB', icon: 'time' },
  resolved:    { label: 'Resolved',    color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle' },
};

const SECTION_ORDER = ['open', 'in_progress', 'resolved'];

export default function ComplaintsScreen() {
  const { user, hasActiveSubscription } = useAuth();
  const isPramukh = user?.role === 'pramukh';
  const isAdmin = user?.role === 'admin';
  const router = useRouter();
  const { mine, view } = useLocalSearchParams<{ mine?: string; view?: string }>();

  // Routing logic:
  // Home screen (user)    → view=society  → /building  → all society complaints
  // Home screen (pramukh) → no param      → /building  → all society complaints + update button
  // Profile (user/pramukh)→ mine=true     → /my        → only their own complaints

  const isSocietyView = view === 'society' || (!mine && !view);
  const isMyView = mine === 'true';
  const showUpdateButton = isPramukh && isSocietyView;

  // Subscription gate — admin is always unlocked
  const isLocked = !isAdmin && !hasActiveSubscription;

  const getEndpoint = () => isMyView ? '/complaints/my' : '/complaints/building';

  const screenTitle = isMyView ? 'My Complaints' : 'Society Complaints';

  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'General', photo_url: '' });
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  const [showUpdate, setShowUpdate] = useState(false);
  const [updateForm, setUpdateForm] = useState({ status: 'open', remark: '' });
  const [updating, setUpdating] = useState(false);

  useFocusEffect(useCallback(() => { fetchComplaints(); }, []));

  const fetchComplaints = async () => {
    if (!user?.building_id) {
      setComplaints([]); setLoading(false); setRefreshing(false); return;
    }
    try {
      const res = await api.get(getEndpoint());
      setComplaints(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || e.message || 'Failed to load');
    } finally { setLoading(false); setRefreshing(false); }
  };

  // Build sections grouped by status
  const sections = SECTION_ORDER
    .map(status => ({
      status,
      data: complaints.filter(c => c.status === status),
    }))
    .filter(s => s.data.length > 0);

  const totalOpen = complaints.filter(c => c.status === 'open').length;
  const totalInProgress = complaints.filter(c => c.status === 'in_progress').length;
  const totalResolved = complaints.filter(c => c.status === 'resolved').length;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true, quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setForm(f => ({ ...f, photo_url: `data:image/jpeg;base64,${result.assets[0].base64}` }));
    }
  };

  const resetForm = () => {
    setForm({ title: '', description: '', category: 'General', photo_url: '' });
    setImageUri(null);
  };

  const submitComplaint = async () => {
    if (!form.title.trim()) return Alert.alert('Error', 'Title is required');
    setSubmitting(true);
    try {
      await api.post('/complaints', form);
      resetForm(); setShowAdd(false);
      fetchComplaints();
      Alert.alert('Submitted', 'Your complaint has been submitted.');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  const openUpdate = (c: any) => {
    setSelectedComplaint(c);
    setUpdateForm({ status: c.status, remark: c.remark || '' });
    setShowUpdate(true);
  };

  const submitUpdate = async () => {
    if (!selectedComplaint) return;
    setUpdating(true);
    try {
      await api.patch(`/complaints/${selectedComplaint.id}/status`, updateForm);
      setShowUpdate(false); fetchComplaints();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to update');
    } finally { setUpdating(false); }
  };

  const renderSectionHeader = ({ section }: { section: any }) => {
    const meta = STATUS_META[section.status];
    return (
      <View style={[styles.sectionHeader, { backgroundColor: meta.bg }]}>
        <View style={[styles.sectionDot, { backgroundColor: meta.color }]} />
        <Text style={[styles.sectionTitle, { color: meta.color }]}>{meta.label}</Text>
        <View style={[styles.sectionCount, { backgroundColor: meta.color }]}>
          <Text style={styles.sectionCountText}>{section.data.length}</Text>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const meta = STATUS_META[item.status] || STATUS_META.open;
    const catIcon = CAT_ICONS[item.category] || CAT_ICONS.General;
    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: meta.color }]}
        onPress={() => { setSelectedComplaint(item); setShowDetail(true); }}
        activeOpacity={0.82}
      >
        <View style={styles.cardTop}>
          <View style={[styles.catIconBox, { backgroundColor: meta.color + '15' }]}>
            <Ionicons name={catIcon as any} size={20} color={meta.color} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            <View style={styles.cardMeta}>
              <Ionicons name="pricetag-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.cardMetaText}>{item.category || 'General'}</Text>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.cardMetaText}>
                {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            {isSocietyView && item.users ? (
              <View style={styles.cardMeta}>
                <Ionicons name="person-outline" size={12} color={Colors.primary} />
                <Text style={[styles.cardMetaText, { color: Colors.primary, fontWeight: '600' }]}>
                  {item.users.name}{item.users.flat_no ? ` · Flat ${item.users.flat_no}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
          {showUpdateButton ? (
            <TouchableOpacity
              style={[styles.updateChip, { backgroundColor: meta.color }]}
              onPress={() => openUpdate(item)}
            >
              <Ionicons name="create-outline" size={14} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
        {item.remark ? (
          <View style={[styles.remarkStrip, { borderLeftColor: meta.color }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={meta.color} />
            <Text style={[styles.remarkText, { color: meta.color }]} numberOfLines={2}>{item.remark}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.summaryRow}>
      <SummaryCard count={totalOpen} label="Open" color="#EF4444" icon="alert-circle" />
      <SummaryCard count={totalInProgress} label="In Progress" color="#D97706" icon="time" />
      <SummaryCard count={totalResolved} label="Resolved" color="#16A34A" icon="checkmark-circle" />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{screenTitle}</Text>
          <Text style={styles.headerSub}>{complaints.length} total complaint{complaints.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={Colors.primary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={complaints.length > 0 ? <ListHeader /> : null}
          contentContainerStyle={{ paddingBottom: 100 }}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchComplaints(); }} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="chatbox-ellipses-outline" size={48} color={Colors.primary + '60'} />
              </View>
              <Text style={styles.emptyTitle}>No Complaints Yet</Text>
              <Text style={styles.emptySubText}>
                {!user?.building_id
                  ? 'Join a building first to view complaints'
                  : isMyView
                  ? 'Tap the button below to raise your first complaint'
                  : 'No complaints raised in your society yet'}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB — Add Complaint (always visible, locked if no subscription) */}
      <TouchableOpacity
        style={[styles.fab, isLocked && styles.fabLocked]}
        onPress={() => {
          if (isLocked) {
            Alert.alert(
              '🔒 Subscription Required',
              'You need an active subscription to raise a complaint.',
              [
                { text: 'Not Now', style: 'cancel' },
                { text: 'View Plans', onPress: () => router.push('/subscribe' as any) },
              ]
            );
            return;
          }
          setShowAdd(true);
        }}
        activeOpacity={0.85}
      >
        {isLocked
          ? <Ionicons name="lock-closed" size={20} color={Colors.white} />
          : <Ionicons name="add" size={26} color={Colors.white} />
        }
        <Text style={styles.fabText}>{isLocked ? 'Subscribe to Add' : 'New Complaint'}</Text>
      </TouchableOpacity>

      {/* ── Add Complaint Modal ── */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>New Complaint</Text>
              <TouchableOpacity onPress={() => { setShowAdd(false); resetForm(); }} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Water leakage in corridor"
                value={form.title}
                onChangeText={t => setForm(f => ({ ...f, title: t }))}
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, form.category === cat && styles.chipActive]}
                      onPress={() => setForm(f => ({ ...f, category: cat }))}
                    >
                      <Ionicons name={CAT_ICONS[cat] as any} size={14} color={form.category === cat ? Colors.white : Colors.textMuted} />
                      <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the issue in detail..."
                value={form.description}
                onChangeText={t => setForm(f => ({ ...f, description: t }))}
                multiline
                numberOfLines={4}
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.label}>Attach Photo (optional)</Text>
              <TouchableOpacity style={styles.photoPicker} onPress={pickImage}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
                    <Text style={styles.photoPlaceholderText}>Tap to select photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submitComplaint}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color={Colors.white} />
                  : <>
                      <Ionicons name="send-outline" size={18} color={Colors.white} />
                      <Text style={styles.submitBtnText}>Submit Complaint</Text>
                    </>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal visible={showDetail} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Complaint Detail</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            {selectedComplaint ? (() => {
              const meta = STATUS_META[selectedComplaint.status] || STATUS_META.open;
              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Status pill */}
                  <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.color + '50' }]}>
                    <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                    <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                  </View>

                  <Text style={styles.detailTitle}>{selectedComplaint.title}</Text>

                  <View style={styles.detailMetaRow}>
                    <View style={styles.detailMetaItem}>
                      <Ionicons name="pricetag-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.detailMetaText}>{selectedComplaint.category || 'General'}</Text>
                    </View>
                    <View style={styles.detailMetaItem}>
                      <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.detailMetaText}>
                        {new Date(selectedComplaint.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                  </View>

                  {isSocietyView && selectedComplaint.users ? (
                    <View style={styles.residentCard}>
                      <View style={styles.residentAvatar}>
                        <Text style={styles.residentAvatarText}>{selectedComplaint.users.name?.[0]?.toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={styles.residentName}>{selectedComplaint.users.name}</Text>
                        {selectedComplaint.users.flat_no ? (
                          <Text style={styles.residentFlat}>Flat {selectedComplaint.users.flat_no}</Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  {selectedComplaint.description ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockLabel}>Description</Text>
                      <Text style={styles.detailBlockText}>{selectedComplaint.description}</Text>
                    </View>
                  ) : null}

                  {selectedComplaint.photo_url ? (
                    <Image source={{ uri: selectedComplaint.photo_url }} style={styles.detailPhoto} resizeMode="cover" />
                  ) : null}

                  {selectedComplaint.remark ? (
                    <View style={[styles.detailBlock, { backgroundColor: meta.bg, borderLeftWidth: 3, borderLeftColor: meta.color }]}>
                      <Text style={[styles.detailBlockLabel, { color: meta.color }]}>Pramukh Remark</Text>
                      <Text style={styles.detailBlockText}>{selectedComplaint.remark}</Text>
                    </View>
                  ) : null}

                  {showUpdateButton ? (
                    <TouchableOpacity
                      style={styles.submitBtn}
                      onPress={() => { setShowDetail(false); openUpdate(selectedComplaint); }}
                    >
                      <Ionicons name="create-outline" size={18} color={Colors.white} />
                      <Text style={styles.submitBtnText}>Update Status</Text>
                    </TouchableOpacity>
                  ) : null}
                  <View style={{ height: 20 }} />
                </ScrollView>
              );
            })() : null}
          </View>
        </View>
      </Modal>

      {/* ── Pramukh Update Modal ── */}
      <Modal visible={showUpdate} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '65%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Update Status</Text>
              <TouchableOpacity onPress={() => setShowUpdate(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Set Status</Text>
              <View style={styles.statusGrid}>
                {(['open', 'in_progress', 'resolved'] as const).map(s => {
                  const m = STATUS_META[s];
                  const active = updateForm.status === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.statusTile, active && { backgroundColor: m.color, borderColor: m.color }]}
                      onPress={() => setUpdateForm(f => ({ ...f, status: s }))}
                    >
                      <Ionicons name={m.icon as any} size={22} color={active ? '#fff' : m.color} />
                      <Text style={[styles.statusTileText, active && { color: '#fff' }]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Remark (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add a resolution note or remark..."
                value={updateForm.remark}
                onChangeText={t => setUpdateForm(f => ({ ...f, remark: t }))}
                multiline
                numberOfLines={3}
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity
                style={[styles.submitBtn, updating && { opacity: 0.6 }]}
                onPress={submitUpdate}
                disabled={updating}
              >
                {updating
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.submitBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryCard({ count, label, color, icon }: { count: number; label: string; color: string; icon: string }) {
  return (
    <View style={[styles.summaryCard, { borderTopColor: color }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.summaryCount, { color }]}>{count}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 54, paddingBottom: 20, paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  // Summary row
  summaryRow: { flexDirection: 'row', gap: 10, margin: 16 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 4,
    borderTopWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  summaryCount: { fontSize: 24, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 8, marginBottom: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', flex: 1, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionCount: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionCountText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  // Card
  card: {
    backgroundColor: Colors.white, borderRadius: 14,
    marginHorizontal: 16, marginBottom: 10,
    padding: 14, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  catIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  cardDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: 5 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardMetaText: { fontSize: 12, color: Colors.textMuted },
  dot: { fontSize: 12, color: Colors.textMuted },
  updateChip: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  remarkStrip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    borderLeftWidth: 3, paddingLeft: 8,
  },
  remarkText: { fontSize: 13, flex: 1, fontStyle: 'italic', lineHeight: 18 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32, gap: 12 },
  emptyIconBox: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  emptySubText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // FAB
  fab: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 30,
    shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabLocked: {
    backgroundColor: Colors.textMuted,
    shadowColor: Colors.textMuted,
  },
  fabText: { fontSize: 15, fontWeight: '800', color: Colors.white },

  // Modal sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, maxHeight: '92%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center',
  },

  // Form
  label: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    backgroundColor: Colors.bg, borderRadius: 12, padding: 14,
    fontSize: 15, color: Colors.text, marginBottom: 18,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  textArea: { height: 100, textAlignVertical: 'top' },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: Colors.bg,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: Colors.white },

  photoPicker: {
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    borderStyle: 'dashed', marginBottom: 20, overflow: 'hidden',
  },
  photoPlaceholder: { height: 110, justifyContent: 'center', alignItems: 'center', gap: 8 },
  photoPlaceholderText: { fontSize: 13, color: Colors.textMuted },
  photoPreview: { width: '100%', height: 160 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    padding: 16, marginTop: 4, marginBottom: 8,
  },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },

  // Detail modal
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, marginBottom: 14,
  },
  statusPillText: { fontSize: 14, fontWeight: '700' },
  detailTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 12, lineHeight: 26 },
  detailMetaRow: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  detailMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailMetaText: { fontSize: 13, color: Colors.textMuted },
  residentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bg, borderRadius: 12, padding: 12, marginBottom: 14,
  },
  residentAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  residentAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  residentName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  residentFlat: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  detailBlock: {
    backgroundColor: Colors.bg, borderRadius: 12,
    padding: 14, marginBottom: 12,
  },
  detailBlockLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detailBlockText: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  detailPhoto: { width: '100%', height: 200, borderRadius: 14, marginBottom: 14 },

  // Status update grid
  statusGrid: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statusTile: {
    flex: 1, alignItems: 'center', gap: 6,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    paddingVertical: 14, backgroundColor: Colors.white,
  },
  statusTileText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textAlign: 'center' },
});
