import React, { useEffect, useState } from 'react';
import { Colors } from '../../constants/colors';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import BuildingDropdown from '../../components/BuildingDropdown';
import { useBuildings, Building } from '../../hooks/useBuildings';

function Row({ icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, mono ? { fontFamily: 'monospace' } : {}]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export default function BankDetailsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  const [details, setDetails] = useState({ bank_name: '', bank_branch: '', bank_ifsc: '', bank_account: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeBuildingId = isAdmin ? selectedBuilding?.id : user?.building_id;

  useEffect(() => {
    if (activeBuildingId) fetchDetails();
    else setDetails({ bank_name: '', bank_branch: '', bank_ifsc: '', bank_account: '' });
  }, [activeBuildingId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const params = isAdmin ? { building_id: activeBuildingId } : {};
      const res = await api.get('/buildings/bank-details', { params });
      setDetails({
        bank_name: res.data.bank_name || '',
        bank_branch: res.data.bank_branch || '',
        bank_ifsc: res.data.bank_ifsc || '',
        bank_account: res.data.bank_account || '',
      });
    } catch {}
    finally { setLoading(false); }
  };

  const save = async () => {
    if (isAdmin && !selectedBuilding) return Alert.alert('Error', 'Please select a building first');
    setSaving(true);
    try {
      const payload: any = { ...details };
      if (isAdmin) payload.building_id = selectedBuilding!.id;
      await api.post('/buildings/bank-details', payload);
      setEditing(false);
      Alert.alert('Saved', 'Bank details updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bank Details</Text>
        {activeBuildingId && (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(!editing)}>
            <Ionicons name={editing ? 'close' : 'create-outline'} size={20} color={Colors.white} />
            <Text style={styles.editBtnText}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Admin building selector */}
      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown
            buildings={buildings}
            loading={buildingsLoading}
            selected={selectedBuilding}
            onSelect={(b) => { setSelectedBuilding(b); setEditing(false); }}
            label="Select Society / Building"
          />
        </View>
      )}

      {isAdmin && !selectedBuilding ? (
        <View style={styles.emptyBox}>
          <Ionicons name="business-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyText}>Select a society to view or edit bank details</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {isAdmin && selectedBuilding && (
            <View style={styles.buildingBadge}>
              <Ionicons name="business" size={15} color={Colors.primary} />
              <Text style={styles.buildingBadgeText}>{selectedBuilding.name}</Text>
            </View>
          )}

          <View style={styles.card}>
            {editing ? (
              <View>
                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput style={styles.input} value={details.bank_name} onChangeText={(v) => setDetails({ ...details, bank_name: v })} placeholder="e.g. State Bank of India" placeholderTextColor={Colors.textMuted} />
                <Text style={styles.inputLabel}>Branch</Text>
                <TextInput style={styles.input} value={details.bank_branch} onChangeText={(v) => setDetails({ ...details, bank_branch: v })} placeholder="e.g. Andheri West" placeholderTextColor={Colors.textMuted} />
                <Text style={styles.inputLabel}>IFSC Code</Text>
                <TextInput style={styles.input} value={details.bank_ifsc} onChangeText={(v) => setDetails({ ...details, bank_ifsc: v.toUpperCase() })} placeholder="e.g. SBIN0001234" placeholderTextColor={Colors.textMuted} autoCapitalize="characters" />
                <Text style={styles.inputLabel}>Account Number</Text>
                <TextInput style={styles.input} value={details.bank_account} onChangeText={(v) => setDetails({ ...details, bank_account: v })} placeholder="e.g. 1234567890" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
                <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                  {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Save Bank Details</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Row icon="business-outline" label="Bank Name" value={details.bank_name} />
                <Row icon="location-outline" label="Branch" value={details.bank_branch} />
                <Row icon="barcode-outline" label="IFSC Code" value={details.bank_ifsc} mono />
                <Row icon="card-outline" label="Account Number" value={details.bank_account} mono />
              </View>
            )}
          </View>

          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.hintText}>These details are used for offline/cash payment reference by residents.</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  editBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 15, color: Colors.textMuted, textAlign: 'center' },
  buildingBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary + '12', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, alignSelf: 'flex-start' },
  buildingBadgeText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 12, color: Colors.textMuted },
  rowValue: { fontSize: 15, fontWeight: '600', color: Colors.text, marginTop: 2 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, padding: 12, backgroundColor: Colors.white, borderRadius: 12 },
  hintText: { flex: 1, fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
});
