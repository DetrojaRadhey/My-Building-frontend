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
import { useBuildings } from '../../hooks/useBuildings';
import BuildingDropdown from '../../components/BuildingDropdown';
import type { Building } from '../../hooks/useBuildings';

type Tab = 'vehicles' | 'reports';

function VehicleDropdown({ vehicles, selected, onSelect, isAdmin, hasBuilding }: {
  vehicles: any[];
  selected: string;
  onSelect: (vn: string) => void;
  isAdmin: boolean;
  hasBuilding: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selectedVehicle = vehicles.find(v => v.vehicle_number === selected);
  const displayLabel = selectedVehicle
    ? `${selectedVehicle.vehicle_type === 'four_wheeler' ? '🚗' : '🏍️'}  ${selectedVehicle.vehicle_number}`
    : 'Select vehicle number';

  if (!hasBuilding) {
    return (
      <View style={ddStyles.trigger}>
        <Ionicons name="car-outline" size={18} color={Colors.textMuted} />
        <Text style={ddStyles.placeholder}>Select a building first</Text>
      </View>
    );
  }

  if (vehicles.length === 0) {
    return (
      <View style={ddStyles.trigger}>
        <Ionicons name="car-outline" size={18} color={Colors.textMuted} />
        <Text style={ddStyles.placeholder}>No vehicles registered</Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 4 }}>
      <TouchableOpacity style={[ddStyles.trigger, open && ddStyles.triggerOpen]} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Ionicons name="car-outline" size={18} color={selected ? Colors.primary : Colors.textMuted} />
        <Text style={[ddStyles.triggerText, selected && ddStyles.triggerTextSelected]}>{displayLabel}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      {open && (
        <View style={ddStyles.menu}>
          {vehicles.map((v: any) => {
            const active = selected === v.vehicle_number;
            return (
              <TouchableOpacity
                key={v.id}
                style={[ddStyles.item, active && ddStyles.itemActive]}
                onPress={() => { onSelect(v.vehicle_number); setOpen(false); }}
              >
                <Text style={ddStyles.itemEmoji}>{v.vehicle_type === 'four_wheeler' ? '🚗' : '🏍️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[ddStyles.itemText, active && ddStyles.itemTextActive]}>{v.vehicle_number}</Text>
                  {v.users ? (
                    <Text style={ddStyles.itemSub}>{v.users.name}{v.users.flat_no ? ` · Flat ${v.users.flat_no}` : ''}</Text>
                  ) : null}
                </View>
                {active && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const ddStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    padding: 12, backgroundColor: Colors.bg, marginBottom: 12,
  },
  triggerOpen: { borderColor: Colors.primary, backgroundColor: Colors.white },
  triggerText: { flex: 1, fontSize: 15, color: Colors.textMuted },
  triggerTextSelected: { color: Colors.text, fontWeight: '600' },
  placeholder: { flex: 1, fontSize: 15, color: Colors.textMuted },
  menu: {
    borderWidth: 1.5, borderColor: Colors.primary + '40', borderRadius: 10,
    backgroundColor: Colors.white, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  itemActive: { backgroundColor: Colors.primary + '10' },
  itemEmoji: { fontSize: 18 },
  itemText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  itemTextActive: { color: Colors.primary },
  itemSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
});

export default function ParkingScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const params = useLocalSearchParams<{ building_id?: string; building_name?: string }>();

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  useEffect(() => {
    if (params.building_id && params.building_name && isAdmin) {
      setSelectedBuilding({ id: params.building_id, name: params.building_name });
    }
  }, [params.building_id]);

  const [tab, setTab] = useState<Tab>('vehicles');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showEditVehicle, setShowEditVehicle] = useState<any>(null);
  const [vehicleForm, setVehicleForm] = useState({ vehicle_number: '', vehicle_type: 'two_wheeler' });
  const [editForm, setEditForm] = useState({ vehicle_number: '', vehicle_type: 'two_wheeler' });
  const [reportForm, setReportForm] = useState({ description: '', vehicle_number: '', location: '' });
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // For admin report modal, track selected building separately
  const [reportBuilding, setReportBuilding] = useState<Building | null>(null);

  const fetchData = async () => {
    try {
      const buildingId = isAdmin ? selectedBuilding?.id : undefined;
      const suffix = buildingId ? `?building_id=${buildingId}` : '';
      const [vRes, rRes] = await Promise.all([
        api.get(`/vehicles/building${suffix}`),
        api.get(`/vehicles/reports${suffix}`),
      ]);
      setVehicles(vRes.data);
      setReports(rRes.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedBuilding]);

  const addVehicle = async () => {
    if (!vehicleForm.vehicle_number.trim()) return Alert.alert('Error', 'Vehicle number is required');
    setSubmitting(true);
    try {
      await api.post('/vehicles', vehicleForm);
      setShowAddVehicle(false);
      setVehicleForm({ vehicle_number: '', vehicle_type: 'two_wheeler' });
      fetchData();
      Alert.alert('Added', 'Vehicle registered successfully');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to add vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReport = async () => {
    if (isAdmin && !reportBuilding) return Alert.alert('Error', 'Please select a building');
    const desc = reportForm.description.trim();
    if (!desc) return Alert.alert('Error', 'Description is required');
    const wordCount = desc.split(/\s+/).filter(Boolean).length;
    if (wordCount < 5) return Alert.alert('Error', 'Description must be at least 5 words');
    setSubmitting(true);
    try {
      await api.post('/vehicles/report', {
        ...reportForm,
        ...(isAdmin && reportBuilding ? { building_id: reportBuilding.id } : {}),
      });
      setShowReport(false);
      setReportForm({ description: '', vehicle_number: '', location: '' });
      setReportBuilding(null);
      fetchData();
      Alert.alert('Reported', 'Parking report submitted. Pramukh has been notified.');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const sendReminder = async (vehicleNumber: string) => {
    try {
      await api.post('/vehicles/reminder', { vehicle_number: vehicleNumber, message: '' });
      Alert.alert('Sent', 'Parking reminder sent to vehicle owner');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to send reminder');
    }
  };

  const adminDeleteVehicle = (id: string, num: string) => {
    Alert.alert('Delete Vehicle', `Delete ${num}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/vehicles/admin/${id}`);
          setVehicles(prev => prev.filter(v => v.id !== id));
        } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
      }},
    ]);
  };

  const openAdminEdit = (item: any) => {
    setEditForm({ vehicle_number: item.vehicle_number, vehicle_type: item.vehicle_type });
    setShowEditVehicle(item);
  };

  const saveAdminEdit = async () => {
    if (!showEditVehicle) return;
    setSubmitting(true);
    try {
      const res = await api.patch(`/vehicles/admin/${showEditVehicle.id}`, editForm);
      setVehicles(prev => prev.map(v => v.id === showEditVehicle.id ? { ...v, ...res.data.vehicle } : v));
      setShowEditVehicle(null);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  const filteredVehicles = vehicles.filter((v) =>
    !search || v.vehicle_number.includes(search.toUpperCase())
  );

  const renderVehicle = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.vehicleIcon, { backgroundColor: item.vehicle_type === 'four_wheeler' ? Colors.primary + '20' : Colors.accent + '20' }]}>
          <Text style={styles.vehicleEmoji}>{item.vehicle_type === 'four_wheeler' ? '🚗' : '🏍️'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vehicleNumber}>{item.vehicle_number}</Text>
          <Text style={styles.vehicleType}>{item.vehicle_type === 'four_wheeler' ? 'Four Wheeler' : 'Two Wheeler'}</Text>
        </View>
        {item.users && (
          <View style={styles.ownerInfo}>
            <Text style={styles.ownerName}>{item.users.name}</Text>
            <Text style={styles.ownerFlat}>Flat {item.users.flat_no}</Text>
          </View>
        )}
      </View>
      {(user?.role === 'pramukh' || isAdmin) && (
        <View style={styles.cardFooterRow}>
          <TouchableOpacity style={styles.reminderBtn} onPress={() => sendReminder(item.vehicle_number)}>
            <Ionicons name="notifications-outline" size={14} color={Colors.warning} />
            <Text style={styles.reminderBtnText}>Send Reminder</Text>
          </TouchableOpacity>
          {isAdmin && (
            <View style={styles.adminBtns}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openAdminEdit(item)}>
                <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => adminDeleteVehicle(item.id, item.vehicle_number)}>
                <Ionicons name="trash-outline" size={15} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderReport = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportIcon}>🚨</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.reportDesc}>{item.description}</Text>
          {item.vehicle_number && <Text style={styles.reportVehicle}>Vehicle: {item.vehicle_number}</Text>}
          {item.location && <Text style={styles.reportLocation}>📍 {item.location}</Text>}
        </View>
      </View>
      <View style={styles.reportFooter}>
        <Text style={styles.reportBy}>Reported by {item.reported_by}</Text>
        <Text style={styles.reportTime}>{new Date(item.created_at).toLocaleDateString('en-IN')}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parking</Text>
        <View style={styles.headerActions}>
          {user?.role === 'user' && (
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowAddVehicle(true)}>
              <Ionicons name="add" size={22} color={Colors.white} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowReport(true)}>
            <Ionicons name="warning" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Admin building filter */}
      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown
            buildings={buildings}
            loading={buildingsLoading}
            selected={selectedBuilding}
            onSelect={setSelectedBuilding}
            label="Filter by Building"
          />
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'vehicles' && styles.tabBtnActive]} onPress={() => setTab('vehicles')}>
          <Text style={[styles.tabBtnText, tab === 'vehicles' && styles.tabBtnTextActive]}>Vehicles</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'reports' && styles.tabBtnActive]} onPress={() => setTab('reports')}>
          <Text style={[styles.tabBtnText, tab === 'reports' && styles.tabBtnTextActive]}>Reports</Text>
        </TouchableOpacity>
      </View>

      {tab === 'vehicles' && (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vehicle number..."
            value={search}
            onChangeText={setSearch}
            autoCapitalize="characters"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={tab === 'vehicles' ? filteredVehicles : reports}
          keyExtractor={(i) => i.id}
          renderItem={tab === 'vehicles' ? renderVehicle : renderReport}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isAdmin && !selectedBuilding
                ? 'Select a building to view data'
                : tab === 'vehicles' ? 'No vehicles registered' : 'No parking reports'}
            </Text>
          }
        />
      )}

      {/* Add Vehicle Modal */}
      <Modal visible={showAddVehicle} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Vehicle</Text>
            <TouchableOpacity onPress={() => setShowAddVehicle(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Vehicle Number *</Text>
          <TextInput style={styles.input} value={vehicleForm.vehicle_number} onChangeText={(v) => setVehicleForm({ ...vehicleForm, vehicle_number: v })} placeholder="e.g. GJ06HY2323" autoCapitalize="characters" placeholderTextColor={Colors.textMuted} />
          <Text style={styles.label}>Vehicle Type</Text>
          <View style={styles.typeRow}>
            {[{ key: 'two_wheeler', label: '🏍️ Two Wheeler' }, { key: 'four_wheeler', label: '🚗 Four Wheeler' }].map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeBtn, vehicleForm.vehicle_type === t.key && styles.typeBtnActive]}
                onPress={() => setVehicleForm({ ...vehicleForm, vehicle_type: t.key })}
              >
                <Text style={[styles.typeBtnText, vehicleForm.vehicle_type === t.key && styles.typeBtnTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.submitBtn} onPress={addVehicle} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add Vehicle</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Admin Edit Vehicle Modal */}
      <Modal visible={!!showEditVehicle} animationType="slide" presentationStyle="pageSheet">
        {showEditVehicle && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Vehicle</Text>
              <TouchableOpacity onPress={() => setShowEditVehicle(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Vehicle Number *</Text>
            <TextInput style={styles.input} value={editForm.vehicle_number}
              onChangeText={v => setEditForm({ ...editForm, vehicle_number: v.toUpperCase() })}
              placeholder="e.g. GJ05HR4533" autoCapitalize="characters"
              placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Vehicle Type</Text>
            <View style={styles.typeRow}>
              {[{ key: 'two_wheeler', label: '🏍️ Two Wheeler' }, { key: 'four_wheeler', label: '🚗 Four Wheeler' }].map(t => (
                <TouchableOpacity key={t.key}
                  style={[styles.typeBtn, editForm.vehicle_type === t.key && styles.typeBtnActive]}
                  onPress={() => setEditForm({ ...editForm, vehicle_type: t.key })}
                >
                  <Text style={[styles.typeBtnText, editForm.vehicle_type === t.key && styles.typeBtnTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={saveAdminEdit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReport} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report Misparking</Text>
            <TouchableOpacity onPress={() => { setShowReport(false); setReportForm({ description: '', vehicle_number: '', location: '' }); setReportBuilding(null); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {isAdmin && (
              <>
                <BuildingDropdown
                  buildings={buildings}
                  loading={buildingsLoading}
                  selected={reportBuilding}
                  onSelect={(b) => { setReportBuilding(b); setReportForm(f => ({ ...f, vehicle_number: '' })); }}
                  label="Select Building *"
                />
                <View style={{ height: 12 }} />
              </>
            )}

            {/* Description with word count */}
            <Text style={styles.label}>Description <Text style={{ color: Colors.danger }}>*</Text></Text>
            <Text style={styles.labelHint}>Minimum 5 words — describe the issue clearly</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={reportForm.description}
              onChangeText={(v) => setReportForm({ ...reportForm, description: v })}
              placeholder="e.g. Vehicle blocking the main gate entrance since morning..."
              multiline
              numberOfLines={4}
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={[
              styles.wordCount,
              reportForm.description.trim().split(/\s+/).filter(Boolean).length >= 5
                ? { color: Colors.success }
                : { color: Colors.textMuted }
            ]}>
              {reportForm.description.trim().split(/\s+/).filter(Boolean).length} / 5 words minimum
            </Text>

            {/* Vehicle number dropdown */}
            <Text style={styles.label}>Vehicle Number</Text>
            <Text style={styles.labelHint}>Select from registered vehicles in your building</Text>
            <VehicleDropdown
              vehicles={(() => {
                return isAdmin && reportBuilding
                  ? vehicles.filter((v: any) => v.building_id === reportBuilding.id)
                  : vehicles;
              })()}
              selected={reportForm.vehicle_number}
              onSelect={(vn) => setReportForm(f => ({ ...f, vehicle_number: vn }))}
              isAdmin={isAdmin}
              hasBuilding={!isAdmin || !!reportBuilding}
            />

            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={reportForm.location}
              onChangeText={(v) => setReportForm({ ...reportForm, location: v })}
              placeholder="e.g. Near Gate 2, Basement B1"
              placeholderTextColor={Colors.textMuted}
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: Colors.danger }, submitting && { opacity: 0.6 }]}
              onPress={submitReport}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="warning-outline" size={18} color={Colors.white} />
                    <Text style={styles.submitBtnText}>Submit Report</Text>
                  </>
              }
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
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 8 },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.white, marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabBtnTextActive: { color: Colors.white },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicleIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  vehicleEmoji: { fontSize: 24 },
  vehicleNumber: { fontSize: 18, fontWeight: '800', color: Colors.text, letterSpacing: 1 },
  vehicleType: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  ownerInfo: { alignItems: 'flex-end' },
  ownerName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  ownerFlat: { fontSize: 12, color: Colors.textMuted },
  reminderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 },
  reminderBtnText: { fontSize: 13, color: Colors.warning, fontWeight: '600' },
  cardFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  adminBtns: { flexDirection: 'row', gap: 8 },
  editBtn: { padding: 8, backgroundColor: Colors.primary + '15', borderRadius: 8 },
  deleteBtn: { padding: 8, backgroundColor: Colors.danger + '15', borderRadius: 8 },
  reportHeader: { flexDirection: 'row', gap: 10 },
  reportIcon: { fontSize: 22 },
  reportDesc: { fontSize: 14, fontWeight: '600', color: Colors.text },
  reportVehicle: { fontSize: 13, color: Colors.primary, marginTop: 4, fontWeight: '700' },
  reportLocation: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  reportFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  reportBy: { fontSize: 12, color: Colors.textMuted },
  reportTime: { fontSize: 12, color: Colors.textMuted },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 60, fontSize: 16 },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  typeBtnTextActive: { color: Colors.white },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20, marginBottom: 20, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  textArea: { height: 100, textAlignVertical: 'top' },
  labelHint: { fontSize: 12, color: Colors.textMuted, marginBottom: 6, marginTop: -4 },
  wordCount: { fontSize: 12, fontWeight: '600', marginTop: 4, marginBottom: 12, textAlign: 'right' },
});
