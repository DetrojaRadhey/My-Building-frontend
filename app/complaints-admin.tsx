import React, { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView, Image, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../utils/api';
import BuildingDropdown from '../components/BuildingDropdown';
import type { Building } from '../hooks/useBuildings';
import { useBuildings } from '../hooks/useBuildings';

const CATEGORIES = ['General', 'Water', 'Electricity', 'Cleanliness', 'Security', 'Parking', 'Noise', 'Other'];

const CAT_ICONS: Record<string, string> = {
  General: 'alert-circle-outline', Water: 'water-outline',
  Electricity: 'flash-outline', Cleanliness: 'trash-outline',
  Security: 'shield-outline', Parking: 'car-outline',
  Noise: 'volume-high-outline', Other: 'ellipsis-horizontal-circle-outline',
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  open: { label: 'Open', color: '#EF4444', bg: '#FEF2F2', icon: 'alert-circle' },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB', icon: 'time' },
  resolved: { label: 'Resolved', color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle' },
};

const SECTION_ORDER = ['open', 'in_progress', 'resolved'];

export default function AdminComplaintsScreen() {
  const { buildings } = useBuildings(true);
  const router = useRouter();
  const { t } = useLanguage();
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', description: '', category: 'General', photo_url: '' });
  const [addBuilding, setAddBuilding] = useState<Building | null>(null);
  const [addImageUri, setAddImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: 'General', status: 'open', remark: '', photo_url: '' });
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [activeStatus, setActiveStatus] = useState<'open' | 'in_progress' | 'resolved'>('open');
  const [imageViewerUri, setImageViewerUri] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { fetchComplaints(); }, [selectedBuilding]));

  const fetchComplaints = async () => {
    try {
      let url = '/complaints/admin';
      if (selectedBuilding) url += `?building_id=${selectedBuilding.id}`;
      const res = await api.get(url);
      setComplaints(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally { setLoading(false); setRefreshing(false); }
  };

  // Sections grouped by status
  const totalOpen = complaints.filter(c => c.status === 'open').length;
  const totalInProgress = complaints.filter(c => c.status === 'in_progress').length;
  const totalResolved = complaints.filter(c => c.status === 'resolved').length;
  const filteredComplaints = useMemo(
    () => complaints.filter(c => c.status === activeStatus),
    [complaints, activeStatus]
  );

  const pickImage = async (
    setter: (uri: string | null) => void,
    formSetter: (fn: (f: any) => any) => void
  ) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
      formSetter(f => ({ ...f, photo_url: `data:image/jpeg;base64,${result.assets[0].base64}` }));
    }
  };

  const submitAdd = async () => {
    if (!addForm.title.trim()) return Alert.alert('Error', 'Title is required');
    if (!addBuilding) return Alert.alert('Error', 'Select a building');
    setSubmitting(true);
    try {
      await api.post('/complaints/admin', { ...addForm, building_id: addBuilding.id });
      setAddForm({ title: '', description: '', category: 'General', photo_url: '' });
      setAddBuilding(null); setAddImageUri(null); setShowAdd(false);
      fetchComplaints();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  const openEdit = (item: any) => {
    setEditTarget(item);
    setEditForm({
      title: item.title, description: item.description || '',
      category: item.category || 'General', status: item.status,
      remark: item.remark || '', photo_url: item.photo_url || '',
    });
    setEditImageUri(item.photo_url || null);
    setShowEdit(true);
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await api.put(`/complaints/admin/${editTarget.id}`, editForm);
      setShowEdit(false); fetchComplaints();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  };

  const deleteComplaint = (id: string) => {
    Alert.alert('Delete Complaint', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await api.delete(`/complaints/admin/${id}`); fetchComplaints(); }
          catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
        },
      },
    ]);
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

  const renderItem = useCallback(({ item }: { item: any }) => {
    const meta = STATUS_META[item.status] || STATUS_META.open;
    const catIcon = CAT_ICONS[item.category] || CAT_ICONS.General;
    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: meta.color }]}
        onPress={() => { setDetailItem(item); setShowDetail(true); }}
        activeOpacity={0.82}
      >
        <View style={styles.cardTop}>
          <View style={[styles.catIconBox, { backgroundColor: meta.color + '15' }]}>
            <Ionicons name={catIcon as any} size={20} color={meta.color} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {item.description
              ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              : null}
            {/* Building + user row */}
            <View style={styles.cardMeta}>
              <Ionicons name="business-outline" size={12} color={Colors.primary} />
              <Text style={[styles.cardMetaText, { color: Colors.primary, fontWeight: '600' }]}>
                {item.buildings?.name || '—'}
              </Text>
            </View>
            {item.users ? (
              <View style={styles.cardMeta}>
                <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.cardMetaText}>
                  {item.users.name}{item.users.flat_no ? ` · Flat ${item.users.flat_no}` : ''}
                </Text>
                <Text style={styles.dot}>·</Text>
                <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.cardMetaText}>
                  {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            ) : (
              <View style={styles.cardMeta}>
                <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                <Text style={styles.cardMetaText}>
                  {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            )}
          </View>
          {/* Action buttons */}
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: Colors.primary + '15' }]}
              onPress={() => openEdit(item)}
            >
              <Ionicons name="create-outline" size={15} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: Colors.danger + '15' }]}
              onPress={() => deleteComplaint(item.id)}
            >
              <Ionicons name="trash-outline" size={15} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
        {item.remark ? (
          <View style={[styles.remarkStrip, { borderLeftColor: meta.color }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={meta.color} />
            <Text style={[styles.remarkText, { color: meta.color }]} numberOfLines={2}>{item.remark}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [openEdit, deleteComplaint]);

  const ListHeader = () => (
    <>
      {/* Building filter */}
      <View style={styles.dropdownWrap}>
        <BuildingDropdown
          buildings={buildings}
          selected={selectedBuilding}
          onSelect={setSelectedBuilding}
          placeholder="All Buildings"
          allowClear
        />
      </View>
      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <SummaryCard count={totalOpen} label="Open" color="#EF4444" icon="alert-circle" />
        <SummaryCard count={totalInProgress} label="In Progress" color="#D97706" icon="time" />
        <SummaryCard count={totalResolved} label="Resolved" color="#16A34A" icon="checkmark-circle" />
      </View>
    </>
  );



  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('complaints')}</Text>
          <Text style={styles.headerSub}>{complaints.length} total complaint{complaints.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={Colors.primary} />
      ) : (
        <>
          {/* Building filter */}
          <View style={styles.dropdownWrap}>
            <BuildingDropdown
              buildings={buildings}
              selected={selectedBuilding}
              onSelect={setSelectedBuilding}
              placeholder="All Buildings"
              allowClear
            />
          </View>

          {/* Summary + status tabs */}
          <View style={styles.summaryRow}>
            {([
              { key: 'open', label: 'Open', count: totalOpen, color: '#EF4444', icon: 'alert-circle' },
              { key: 'in_progress', label: 'In Progress', count: totalInProgress, color: '#D97706', icon: 'time' },
              { key: 'resolved', label: 'Resolved', count: totalResolved, color: '#16A34A', icon: 'checkmark-circle' },
            ] as const).map(tab => {
              const active = activeStatus === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.summaryCard, { borderTopColor: tab.color }, active && { backgroundColor: tab.color + '15' }]}
                  onPress={() => setActiveStatus(tab.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={tab.icon as any} size={20} color={tab.color} />
                  <Text style={[styles.summaryCount, { color: tab.color }]}>{tab.count}</Text>
                  <Text style={styles.summaryLabel}>{tab.label}</Text>
                  {active && <View style={[styles.activeTabDot, { backgroundColor: tab.color }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            data={filteredComplaints}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchComplaints(); }}
                tintColor={Colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconBox}>
                  <Ionicons name="chatbox-ellipses-outline" size={48} color={Colors.primary + '60'} />
                </View>
                <Text style={styles.emptyTitle}>No {STATUS_META[activeStatus].label} Complaints</Text>
                <Text style={styles.emptySub}>No complaints found for the selected filter</Text>
              </View>
            }
          />
        </>
      )}

      {/* ── Full-screen Image Viewer ── */}
      <Modal visible={!!imageViewerUri} transparent animationType="fade" onRequestClose={() => setImageViewerUri(null)}>
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setImageViewerUri(null)}>
            <Ionicons name="close-circle" size={36} color={Colors.white} />
          </TouchableOpacity>
          {imageViewerUri && (
            <Image source={{ uri: imageViewerUri }} style={styles.imageViewerImg} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* ── Add Modal ── */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add Complaint</Text>
              <TouchableOpacity onPress={() => { setShowAdd(false); setAddImageUri(null); }} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Building *</Text>
              <BuildingDropdown buildings={buildings} selected={addBuilding} onSelect={setAddBuilding} placeholder="Select building" />
              <View style={{ height: 18 }} />
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input} placeholder="Complaint title"
                value={addForm.title} onChangeText={t => setAddForm(f => ({ ...f, title: t }))}
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, addForm.category === cat && styles.chipActive]}
                      onPress={() => setAddForm(f => ({ ...f, category: cat }))}
                    >
                      <Ionicons name={CAT_ICONS[cat] as any} size={13} color={addForm.category === cat ? Colors.white : Colors.textMuted} />
                      <Text style={[styles.chipText, addForm.category === cat && styles.chipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]} placeholder="Details..."
                value={addForm.description} onChangeText={t => setAddForm(f => ({ ...f, description: t }))}
                multiline numberOfLines={3} placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.label}>Photo (optional)</Text>
              <TouchableOpacity style={styles.photoPicker} onPress={() => pickImage(setAddImageUri, setAddForm)}>
                {addImageUri
                  ? <Image source={{ uri: addImageUri }} style={styles.photoPreview} />
                  : <View style={styles.photoPlaceholder}>
                    <Ionicons name="image-outline" size={30} color={Colors.textMuted} />
                    <Text style={styles.photoPlaceholderText}>Tap to attach photo</Text>
                  </View>
                }
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submitAdd} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.submitBtnText}>Create Complaint</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Edit Complaint</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input} value={editForm.title}
                onChangeText={t => setEditForm(f => ({ ...f, title: t }))}
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, editForm.category === cat && styles.chipActive]}
                      onPress={() => setEditForm(f => ({ ...f, category: cat }))}
                    >
                      <Ionicons name={CAT_ICONS[cat] as any} size={13} color={editForm.category === cat ? Colors.white : Colors.textMuted} />
                      <Text style={[styles.chipText, editForm.category === cat && styles.chipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]} value={editForm.description}
                onChangeText={t => setEditForm(f => ({ ...f, description: t }))}
                multiline numberOfLines={3} placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusGrid}>
                {(['open', 'in_progress', 'resolved'] as const).map(s => {
                  const m = STATUS_META[s];
                  const active = editForm.status === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.statusTile, active && { backgroundColor: m.color, borderColor: m.color }]}
                      onPress={() => setEditForm(f => ({ ...f, status: s }))}
                    >
                      <Ionicons name={m.icon as any} size={20} color={active ? '#fff' : m.color} />
                      <Text style={[styles.statusTileText, active && { color: '#fff' }]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.label}>Remark</Text>
              <TextInput
                style={[styles.input, styles.textArea]} value={editForm.remark}
                onChangeText={t => setEditForm(f => ({ ...f, remark: t }))}
                multiline numberOfLines={3} placeholder="Add remark..."
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.label}>Photo</Text>
              <TouchableOpacity style={styles.photoPicker} onPress={() => pickImage(setEditImageUri, setEditForm)}>
                {editImageUri
                  ? <Image source={{ uri: editImageUri }} style={styles.photoPreview} />
                  : <View style={styles.photoPlaceholder}>
                    <Ionicons name="image-outline" size={30} color={Colors.textMuted} />
                    <Text style={styles.photoPlaceholderText}>Tap to change photo</Text>
                  </View>
                }
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={submitEdit} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.submitBtnText}>{t('saveChanges')}</Text>}
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
            {detailItem ? (() => {
              const meta = STATUS_META[detailItem.status] || STATUS_META.open;
              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.color + '50' }]}>
                    <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                    <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <Text style={styles.detailTitle}>{detailItem.title}</Text>
                  <View style={styles.detailMetaRow}>
                    <View style={styles.detailMetaItem}>
                      <Ionicons name="pricetag-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.detailMetaText}>{detailItem.category || 'General'}</Text>
                    </View>
                    <View style={styles.detailMetaItem}>
                      <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.detailMetaText}>
                        {new Date(detailItem.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                  </View>
                  {/* Building + resident */}
                  <View style={styles.detailInfoRow}>
                    <View style={styles.detailInfoCard}>
                      <Ionicons name="business-outline" size={16} color={Colors.primary} />
                      <Text style={styles.detailInfoText}>{detailItem.buildings?.name || '—'}</Text>
                    </View>
                    {detailItem.users ? (
                      <View style={styles.detailInfoCard}>
                        <View style={styles.residentAvatar}>
                          <Text style={styles.residentAvatarText}>{detailItem.users.name?.[0]?.toUpperCase()}</Text>
                        </View>
                        <View>
                          <Text style={styles.detailInfoText}>{detailItem.users.name}</Text>
                          {detailItem.users.flat_no
                            ? <Text style={styles.detailInfoSub}>Flat {detailItem.users.flat_no}</Text>
                            : null}
                        </View>
                      </View>
                    ) : null}
                  </View>
                  {detailItem.description ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockLabel}>Description</Text>
                      <Text style={styles.detailBlockText}>{detailItem.description}</Text>
                    </View>
                  ) : null}
                  {detailItem.photo_url ? (
                    <TouchableOpacity onPress={() => setPreviewImageUrl(detailItem.photo_url)} activeOpacity={0.8}>
                      <Image source={{ uri: detailItem.photo_url }} style={styles.detailPhoto} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : null}
                  {detailItem.remark ? (
                    <View style={[styles.detailBlock, { backgroundColor: meta.bg, borderLeftWidth: 3, borderLeftColor: meta.color }]}>
                      <Text style={[styles.detailBlockLabel, { color: meta.color }]}>Remark</Text>
                      <Text style={styles.detailBlockText}>{detailItem.remark}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailActions}>
                    <TouchableOpacity
                      style={[styles.detailActionBtn, { backgroundColor: Colors.primary }]}
                      onPress={() => { setShowDetail(false); openEdit(detailItem); }}
                    >
                      <Ionicons name="create-outline" size={18} color={Colors.white} />
                      <Text style={styles.detailActionText}>{t('edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.detailActionBtn, { backgroundColor: Colors.danger }]}
                      onPress={() => { setShowDetail(false); deleteComplaint(detailItem.id); }}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.white} />
                      <Text style={styles.detailActionText}>{t('delete')}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ height: 20 }} />
                </ScrollView>
              );
            })() : null}
          </View>
        </View>
      </Modal>

      {/* ── Image Preview Modal ── */}
      <Modal visible={!!previewImageUrl} transparent animationType="fade" onRequestClose={() => setPreviewImageUrl(null)}>
        <TouchableOpacity style={styles.imagePreviewOverlay} activeOpacity={1} onPress={() => setPreviewImageUrl(null)}>
          <View style={styles.imagePreviewContainer} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.imagePreviewCloseBtn} onPress={() => setPreviewImageUrl(null)}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <ScrollView
              contentContainerStyle={styles.imagePreviewScroll}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image source={{ uri: previewImageUrl || '' }} style={styles.imagePreviewPhoto} resizeMode="contain" />
            </ScrollView>
          </View>
        </TouchableOpacity>
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

  header: {
    backgroundColor: '#3B5FC0', paddingTop: 54, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  dropdownWrap: { margin: 16, marginBottom: 0 },

  summaryRow: { flexDirection: 'row', gap: 10, margin: 16 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 4, borderTopWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  summaryCount: { fontSize: 24, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 8, marginBottom: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', flex: 1, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionCount: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionCountText: { fontSize: 12, fontWeight: '800', color: '#fff' },

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
  cardDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  cardMetaText: { fontSize: 12, color: Colors.textMuted },
  dot: { fontSize: 12, color: Colors.textMuted },
  cardActions: { gap: 6 },
  iconBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  remarkStrip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    borderLeftWidth: 3, paddingLeft: 8,
  },
  remarkText: { fontSize: 13, flex: 1, fontStyle: 'italic', lineHeight: 18 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyIconBox: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

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

  label: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    backgroundColor: Colors.bg, borderRadius: 12, padding: 14,
    fontSize: 15, color: Colors.text, marginBottom: 18,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  textArea: { height: 90, textAlignVertical: 'top' },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: Colors.bg,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: Colors.white },

  statusGrid: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statusTile: {
    flex: 1, alignItems: 'center', gap: 6,
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    paddingVertical: 14, backgroundColor: Colors.white,
  },
  statusTileText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textAlign: 'center' },
  activeTabDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imageViewerClose: { position: 'absolute', top: 56, right: 20, zIndex: 10 },
  imageViewerImg: { width: '100%', height: '80%' },
  tapToExpand: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 8 },

  photoPicker: {
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    borderStyle: 'dashed', marginBottom: 20, overflow: 'hidden',
  },
  photoPlaceholder: { height: 100, justifyContent: 'center', alignItems: 'center', gap: 8 },
  photoPlaceholderText: { fontSize: 13, color: Colors.textMuted },
  photoPreview: { width: '100%', height: 150 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    padding: 16, marginTop: 4, marginBottom: 8,
  },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },

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
  detailInfoRow: { gap: 10, marginBottom: 14 },
  detailInfoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bg, borderRadius: 12, padding: 12,
  },
  detailInfoText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  detailInfoSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  residentAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  residentAvatarText: { fontSize: 14, fontWeight: '800', color: Colors.white },
  detailBlock: {
    backgroundColor: Colors.bg, borderRadius: 12,
    padding: 14, marginBottom: 12,
  },
  detailBlockLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  detailBlockText: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  detailPhoto: { width: '100%', height: 200, borderRadius: 14, marginBottom: 14 },
  detailActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  detailActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, borderRadius: 12, padding: 14,
  },
  detailActionText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  imagePreviewOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', alignItems: 'center',
  },
  imagePreviewContainer: {
    width: '90%', aspectRatio: 1,
    backgroundColor: '#000', borderRadius: 16,
    overflow: 'hidden', position: 'relative',
  },
  imagePreviewCloseBtn: {
    position: 'absolute', top: 12, right: 12,
    zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20, padding: 4,
  },
  imagePreviewScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  imagePreviewPhoto: { width: '100%', height: '100%' },
});
