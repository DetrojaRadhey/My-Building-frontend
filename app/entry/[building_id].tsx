import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { ENTRY_BASE } from '../../constants/api';
import { Colors } from '../../constants/colors';

export default function EntryFormScreen() {
  const { building_id } = useLocalSearchParams<{ building_id: string }>();
  const [building, setBuilding] = useState<any>(null);
  const [form, setForm] = useState({ name: '', phone: '', flat_no: '', work_detail: '' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loadingBuilding, setLoadingBuilding] = useState(true);

  useEffect(() => {
    axios.get(`${ENTRY_BASE}/building/${building_id}`)
      .then((r) => setBuilding(r.data))
      .catch(() => {})
      .finally(() => setLoadingBuilding(false));
  }, [building_id]);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Camera permission is required');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const PHONE_RE = /^[6-9]\d{9}$/;

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.flat_no.trim())
      return Alert.alert('Required', 'Name, phone and flat number are required');
    if (!PHONE_RE.test(form.phone.trim()))
      return Alert.alert('Invalid Phone', 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9');
    if (!photo) return Alert.alert('Required', 'Please take a live photo');

    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      formData.append('photo', { uri: photo, name: 'visitor.jpg', type: 'image/jpeg' } as any);

      await axios.post(`${ENTRY_BASE}/building/${building_id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingBuilding) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={styles.center}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Entry Registered!</Text>
        <Text style={styles.successText}>
          Your visit has been recorded. The building residents have been notified.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerIcon}>🏢</Text>
          <Text style={styles.headerTitle}>{building?.name || 'My Building'}</Text>
          <Text style={styles.headerSub}>Visitor Entry Form</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Your full name" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Mobile Number *</Text>
          <TextInput style={styles.input} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="10-digit mobile number" keyboardType="phone-pad" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Visiting Flat No *</Text>
          <TextInput style={styles.input} value={form.flat_no} onChangeText={(v) => setForm({ ...form, flat_no: v })} placeholder="e.g. A-101" autoCapitalize="characters" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Purpose of Visit</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={form.work_detail} onChangeText={(v) => setForm({ ...form, work_detail: v })} placeholder="e.g. Delivery, Meeting, Repair work..." multiline placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Live Photo *</Text>
          <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
            <Text style={styles.photoBtnIcon}>📷</Text>
            <Text style={styles.photoBtnText}>{photo ? 'Retake Photo' : 'Take Live Photo'}</Text>
          </TouchableOpacity>
          {photo && <Image source={{ uri: photo }} style={styles.photoPreview} />}

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Register Entry</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Colors.bg },
  header: { alignItems: 'center', marginBottom: 24, paddingTop: 20 },
  headerIcon: { fontSize: 48 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, marginTop: 8 },
  headerSub: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  card: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12, padding: 14, justifyContent: 'center' },
  photoBtnIcon: { fontSize: 22 },
  photoBtnText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  photoPreview: { width: '100%', height: 200, borderRadius: 12, marginTop: 12 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 8 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  successIcon: { fontSize: 72, marginBottom: 16 },
  successTitle: { fontSize: 26, fontWeight: '800', color: Colors.success, marginBottom: 12 },
  successText: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 24 },
});
