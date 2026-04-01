import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import BuildingDropdown from '../components/BuildingDropdown';
import { useBuildings } from '../hooks/useBuildings';
import type { Building } from '../hooks/useBuildings';

// Common profession suggestions
const PROFESSION_SUGGESTIONS = [
  'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Security Guard',
  'Lift Technician', 'Pest Control', 'Housekeeping', 'Doctor', 'Ambulance',
  'Fire Station', 'Police', 'Gas Agency', 'Water Supply', 'Other',
];

const PROFESSION_ICONS: Record<string, string> = {
  Plumber: 'water-outline',
  Electrician: 'flash-outline',
  Carpenter: 'hammer-outline',
  Painter: 'color-palette-outline',
  'Security Guard': 'shield-outline',
  'Lift Technician': 'git-commit-outline',
  'Pest Control': 'bug-outline',
  Housekeeping: 'home-outline',
  Doctor: 'medkit-outline',
  Ambulance: 'car-outline',
  'Fire Station': 'flame-outline',
  Police: 'shield-checkmark-outline',
  'Gas Agency': 'flame-outline',
  'Water Supply': 'water-outline',
};

function getProfessionIcon(profession: string): string {
  return PROFESSION_ICONS[profession] || 'call-outline';
}

function getProfessionColor(profession: string): string {
  const colors: Record<string, string> = {
    Plumber: '#0EA5E9', Electrician: '#F59E0B', Carpenter: '#92400E',
    Painter: '#EC4899', 'Security Guard': '#059669', Doctor: '#EF4444',
    Ambulance: '#EF4444', 'Fire Station': '#EF4444', Police: '#1E3A8A',
  };
  return colors[profession] || Colors.primary;
}

export default function HelplineScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh';
  const canManage = isAdmin || isPramukh;

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  const [helplines, setHelplines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [form, setForm] = useState({ profession: '', name: '', phone: '' });

  const activeBuildingId = isAdmin ? selectedBuilding?.id : user?.building_id;

  const fetchHelplines = async () => {
    if (isAdmin && !selectedBuilding) { setLoading(false); setRefreshing(false); return; }
    try {
      const params = isAdmin ? { building_id: activeBuildingId } : {};
      const res = await api.get('/helpline', { params });
      setHelplines(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchHelplines(); }, [selectedBuilding]));

  const PHONE_RE = /^[6-9]\d{9}$/;

  const addHelpline = async () => {
    if (!form.profession.trim() || !form.name.trim() || !form.phone.trim())
      return Alert.alert('Error', 'All fields are required');
    if (!PHONE_RE.test(form.phone.trim()))
      return Alert.alert('Invalid Phone', 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9');
    if (isAdmin && !selectedBuilding)
      return Alert.alert('Error', 'Please select a building first');
    setSubmitting(true);
    try {
      const payload: any = { ...form };
      if (isAdmin) payload.building_id = selectedBuilding!.id;
      await api.post('/helpline', payload);
      setShowAdd(false);
      setForm({ profession: '', name: '', phone: '' });
      fetchHelplines();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to add');
    } finally { setSubmitting(false); }
  };

  const deleteHelpline = (id: string, name: string) => {
    Alert.alert('Delete', `Remove ${name} from helpline?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/helpline/${id}`);
            fetchHelplines();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Failed');
          }
        },
      },
    ]);
  };

  const callNumber = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Cannot make call'));
  };

  // Group by profession
  const grouped = helplines.reduce((acc: Record<string, any[]>, item) => {
    if (!acc[item.profession]) acc[item.profession] = [];
    acc[item.profession].push(item);
    return acc;
  }, {});

  const renderItem = ({ item }: { item: any }) => {
    const color = getProfessionColor(item.profession);
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, { backgroundColor: color + '18' }]}>
            <Ionicons name={getProfessionIcon(item.profession) as any} size={22} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardProfession}>{item.profession}</Text>
            <Text style={styles.cardPhone}>{item.phone}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.callBtn, { backgroundColor: Colors.success + '15' }]} onPress={() => callNumber(item.phone)}>
            <Ionicons name="call" size={18} color={Colors.success} />
          </TouchableOpacity>
          {canManage && (
            <TouchableOpacity style={[styles.callBtn, { backgroundColor: Colors.danger + '15' }]} onPress={() => deleteHelpline(item.id, item.name)}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const flatData = helplines;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Helpline Numbers</Text>
        {canManage ? (
          <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addBtn}>
            <Ionicons name="add" size={24} color={Colors.white} />
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
      </View>

      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown
            buildings={buildings}
            loading={buildingsLoading}
            selected={selectedBuilding}
            onSelect={(b) => { setSelectedBuilding(b); setHelplines([]); setLoading(true); }}
            label="Select Society"
          />
        </View>
      )}

      {isAdmin && !selectedBuilding ? (
        <View style={styles.emptyBox}>
          <Ionicons name="business-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyText}>Select a society to view helpline numbers</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : flatData.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="call-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyText}>No helpline numbers added yet</Text>
          {canManage && (
            <TouchableOpacity style={styles.addFirstBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.addFirstBtnText}>Add First Number</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHelplines(); }} />}
        />
      )}

      {/* Add Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Helpline Number</Text>
            <TouchableOpacity onPress={() => { setShowAdd(false); setForm({ profession: '', name: '', phone: '' }); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {isAdmin && (
            <BuildingDropdown buildings={buildings} loading={buildingsLoading} selected={selectedBuilding} onSelect={setSelectedBuilding} label="Select Building *" />
          )}

          <Text style={styles.label}>Profession *</Text>
          <TouchableOpacity style={styles.select} onPress={() => setShowSuggestions(true)}>
            <Text style={[styles.selectText, !form.profession && { color: Colors.textMuted }]}>
              {form.profession || 'Select or type profession'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={form.profession}
            onChangeText={v => setForm(f => ({ ...f, profession: v }))}
            placeholder="Or type custom profession"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Ramesh Kumar" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Phone Number *</Text>
          <TextInput style={styles.input} value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} placeholder="e.g. 9876543210" keyboardType="phone-pad" maxLength={15} placeholderTextColor={Colors.textMuted} />

          <TouchableOpacity style={styles.submitBtn} onPress={addHelpline} disabled={submitting}>
            {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitBtnText}>Add Helpline</Text>}
          </TouchableOpacity>
        </View>

        {/* Profession picker */}
        <Modal visible={showSuggestions} transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Profession</Text>
                <TouchableOpacity onPress={() => setShowSuggestions(false)}>
                  <Ionicons name="close" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={PROFESSION_SUGGESTIONS}
                keyExtractor={i => i}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.pickerItem} onPress={() => { setForm(f => ({ ...f, profession: item })); setShowSuggestions(false); }}>
                    <Ionicons name={getProfessionIcon(item) as any} size={18} color={getProfessionColor(item)} />
                    <Text style={styles.pickerItemText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  addBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardProfession: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  cardPhone: { fontSize: 13, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8 },
  callBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 15, color: Colors.textMuted, textAlign: 'center' },
  addFirstBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  addFirstBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg, marginBottom: 4 },
  select: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, backgroundColor: Colors.bg, marginBottom: 8 },
  selectText: { fontSize: 15, color: Colors.text },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerItemText: { fontSize: 15, color: Colors.text },
});
