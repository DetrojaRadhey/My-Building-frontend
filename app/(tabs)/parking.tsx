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
  const [vehicleForm, setVehicleForm] = useState({ vehicle_number: '', vehicle_type: 'two_wheeler' });
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
    if (!reportForm.description.trim()) return Alert.alert('Error', 'Description is required');
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
        <TouchableOpacity style={styles.reminderBtn} onPress={() => sendReminder(item.vehicle_number)}>
          <Ionicons name="notifications-outline" size={14} color={Colors.warning} />
          <Text style={styles.reminderBtnText}>Send Reminder</Text>
        </TouchableOpacity>
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

      {/* Report Modal */}
      <Modal visible={showReport} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report Misparking</Text>
            <TouchableOpacity onPress={() => setShowReport(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {isAdmin && (
              <BuildingDropdown
                buildings={buildings}
                loading={buildingsLoading}
                selected={reportBuilding}
                onSelect={setReportBuilding}
                label="Select Building *"
              />
            )}
            <Text style={styles.label}>Description *</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={reportForm.description} onChangeText={(v) => setReportForm({ ...reportForm, description: v })} placeholder="Describe the parking issue..." multiline placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Vehicle Number (if known)</Text>
            <TextInput style={styles.input} value={reportForm.vehicle_number} onChangeText={(v) => setReportForm({ ...reportForm, vehicle_number: v })} placeholder="e.g. GJ06HY2323" autoCapitalize="characters" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Location</Text>
            <TextInput style={styles.input} value={reportForm.location} onChangeText={(v) => setReportForm({ ...reportForm, location: v })} placeholder="e.g. Near Gate 2" placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: Colors.danger }]} onPress={submitReport} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Report</Text>}
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
  reminderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  reminderBtnText: { fontSize: 13, color: Colors.warning, fontWeight: '600' },
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
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
