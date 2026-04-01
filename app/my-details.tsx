import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function MyDetailsScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState({
    phone: user?.phone || '',
    flat_no: user?.flat_no || '',
    wing: user?.wing || '',
    total_members: user?.total_members ? String(user.total_members) : '',
  });

  useEffect(() => {
    setDetails({
      phone: user?.phone || '',
      flat_no: user?.flat_no || '',
      wing: user?.wing || '',
      total_members: user?.total_members ? String(user.total_members) : '',
    });
  }, [user]);

  const cancelEdit = () => {
    setEditing(false);
    setDetails({
      phone: user?.phone || '',
      flat_no: user?.flat_no || '',
      wing: user?.wing || '',
      total_members: user?.total_members ? String(user.total_members) : '',
    });
  };

  const PHONE_RE = /^[6-9]\d{9}$/;

  const saveDetails = async () => {
    if (details.phone && !PHONE_RE.test(details.phone.trim()))
      return Alert.alert('Invalid Phone', 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9');
    if (details.total_members && (isNaN(Number(details.total_members)) || Number(details.total_members) < 1))
      return Alert.alert('Invalid', 'Total members must be a positive number');
    setSaving(true);
    try {
      await api.patch('/auth/profile', {
        phone: details.phone,
        flat_no: details.flat_no,
        wing: details.wing,
        total_members: details.total_members || null,
      });
      await refreshUser();
      setEditing(false);
      Alert.alert('Saved', 'Your details have been updated');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    { icon: 'call-outline', label: 'Mobile No.', field: 'phone', placeholder: 'e.g. 9016114560', keyboardType: 'phone-pad' as const, maxLength: 10 },
    { icon: 'home-outline', label: 'Flat No.', field: 'flat_no', placeholder: 'e.g. 912', keyboardType: 'default' as const },
    { icon: 'people-outline', label: 'Total Members', field: 'total_members', placeholder: 'e.g. 4', keyboardType: 'numeric' as const },
    { icon: 'layers-outline', label: 'Wing', field: 'wing', placeholder: 'e.g. B', keyboardType: 'default' as const },
  ];

  // Auto-open edit mode if phone is missing
  useEffect(() => {
    if (!user?.phone && !editing) setEditing(true);
  }, [user?.phone]);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Details</Text>
        {!editing ? (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
            <Ionicons name="pencil" size={18} color={Colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <View style={styles.card}>
        {!user?.phone && !editing && (
          <View style={styles.missingBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
            <Text style={styles.missingText}>Mobile number not set. Tap Edit to add it.</Text>
          </View>
        )}
        {rows.map((row, idx) => (
          <View key={row.field} style={[styles.row, idx < rows.length - 1 && styles.rowBorder]}>
            <View style={styles.iconBox}>
              <Ionicons name={row.icon as any} size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{row.label}</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={(details as any)[row.field]}
                  onChangeText={(v) => setDetails((d) => ({ ...d, [row.field]: v }))}
                  placeholder={row.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={row.keyboardType}
                  maxLength={row.maxLength}
                  autoFocus={idx === 0}
                />
              ) : (
                <Text style={styles.value}>
                  {(details as any)[row.field] || <Text style={styles.empty}>Not set</Text>}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {editing && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={saveDetails} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.saveText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  editBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  card: { margin: 16, backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  value: { fontSize: 16, fontWeight: '600', color: Colors.text },
  empty: { fontSize: 15, color: Colors.border, fontStyle: 'italic' },
  input: { fontSize: 16, color: Colors.text, borderBottomWidth: 1.5, borderBottomColor: Colors.primary, paddingVertical: 2 },
  actions: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 8 },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
  saveBtn: { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.primary },
  saveText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  missingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warning + '15', padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  missingText: { fontSize: 13, color: Colors.warning, fontWeight: '600', flex: 1 },
});
