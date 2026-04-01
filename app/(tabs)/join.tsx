import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function JoinBuildingScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [buildingId, setBuildingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for approval every 5 seconds after request is sent
  useEffect(() => {
    if (submitted) {
      pollRef.current = setInterval(async () => {
        await refreshUser();
      }, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [submitted]);

  // When user gets building_id (approved), navigate to home
  useEffect(() => {
    if (user?.building_id) {
      if (pollRef.current) clearInterval(pollRef.current);
      router.replace('/' as any);
    }
  }, [user?.building_id]);

  const handleJoin = async () => {
    const trimmed = buildingId.trim();
    if (!trimmed) return Alert.alert('Error', 'Please enter a Building ID');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmed)) return Alert.alert('Invalid ID', 'Please enter a valid Building ID');

    setSubmitting(true);
    try {
      await api.post('/buildings/join', { building_id: trimmed });
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Building</Text>
        </View>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Request Sent!</Text>
          <Text style={styles.successSubtitle}>
            Your request has been sent to the Pramukh. You'll be notified once they approve you.
          </Text>
          <View style={styles.waitingCard}>
            <Ionicons name="time-outline" size={20} color={Colors.warning} />
            <Text style={styles.waitingText}>Waiting for Pramukh approval...</Text>
          </View>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace('/' as any)}>
            <Text style={styles.backHomeBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join a Building</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={22} color={Colors.primary} />
          <Text style={styles.infoText}>
            Ask your Pramukh for the Building ID. It looks like:{'\n'}
            <Text style={styles.exampleId}>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</Text>
          </Text>
        </View>

        <Text style={styles.label}>Building ID</Text>
        <TextInput
          style={styles.input}
          value={buildingId}
          onChangeText={setBuildingId}
          placeholder="Paste or type the Building ID"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {buildingId.length > 0 && (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Building ID entered:</Text>
            <Text style={styles.previewId}>{buildingId}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.submitBtn} onPress={handleJoin} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : (
              <>
                <Ionicons name="enter-outline" size={20} color={Colors.white} />
                <Text style={styles.submitBtnText}>Send Join Request</Text>
              </>
            )
          }
        </TouchableOpacity>

        <Text style={styles.note}>
          Once you submit, the Pramukh of that building will receive a notification and can approve or reject your request.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  content: { padding: 20 },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.primary + '15', borderRadius: 12, padding: 14, marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 20 },
  exampleId: { fontFamily: 'monospace', fontSize: 12, color: Colors.textMuted },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    padding: 14, fontSize: 14, color: Colors.text, backgroundColor: Colors.white,
    fontFamily: 'monospace',
  },
  previewBox: {
    backgroundColor: Colors.white, borderRadius: 10, padding: 12,
    marginTop: 12, borderWidth: 1, borderColor: Colors.border,
  },
  previewLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  previewId: { fontSize: 13, color: Colors.text, fontFamily: 'monospace' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, padding: 16, marginTop: 24,
  },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  note: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  // Success state
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  successSubtitle: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  waitingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.warning + '20', borderRadius: 10, padding: 14, marginBottom: 32,
  },
  waitingText: { fontSize: 14, color: Colors.warning, fontWeight: '600' },
  backHomeBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  backHomeBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
