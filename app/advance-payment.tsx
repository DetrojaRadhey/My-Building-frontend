import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../constants/colors';
import api from '../utils/api';

const PERIOD_OPTIONS = [
  { months: 1, label: '1 Month', icon: '📅' },
  { months: 3, label: '3 Months', icon: '📆' },
  { months: 6, label: '6 Months', icon: '🗓️' },
  { months: 12, label: '1 Year', icon: '🏆' },
];

export default function AdvancePaymentScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<{
    credit_balance: number;
    months_covered: number;
    monthly_amount: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/maintenance/advance/status');
      setStatus(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load advance status');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchStatus(); }, []));

  // Handle deep link return from browser
  useFocusEffect(useCallback(() => {
    const handleUrl = (event: { url: string }) => {
      if (event.url.startsWith('mybuilding://advance-payment')) {
        const params = new URLSearchParams(event.url.split('?')[1]);
        if (params.get('status') === 'success') {
          fetchStatus();
          Alert.alert('✅ Payment Successful', 'Your advance credit has been added to your account.');
        }
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []));

  const payNow = async () => {
    if (!selectedMonths) return Alert.alert('Select Period', 'Please select an advance period first.');
    if (!status?.monthly_amount) return Alert.alert('Error', 'No billing amount configured for this building.');

    setPaying(true);
    try {
      const res = await api.post('/maintenance/advance/order', { months: selectedMonths });
      await WebBrowser.openBrowserAsync(res.data.checkout_url, {
        dismissButtonStyle: 'cancel',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
      fetchStatus();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setPaying(false);
    }
  };

  const totalForSelected = selectedMonths && status?.monthly_amount
    ? selectedMonths * status.monthly_amount
    : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pay in Advance</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Credit balance card */}
          <View style={styles.creditCard}>
            <View style={styles.creditRow}>
              <View>
                <Text style={styles.creditLabel}>Current Credit Balance</Text>
                <Text style={styles.creditAmount}>
                  ₹{(status?.credit_balance || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              {(status?.months_covered || 0) > 0 && (
                <View style={styles.monthsCoveredBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.monthsCoveredText}>
                    {status?.months_covered} month{(status?.months_covered || 0) > 1 ? 's' : ''} covered
                  </Text>
                </View>
              )}
            </View>
            {status?.monthly_amount ? (
              <Text style={styles.monthlyAmountText}>
                Monthly maintenance: ₹{Number(status.monthly_amount).toLocaleString('en-IN')}
              </Text>
            ) : (
              <Text style={styles.noAmountText}>
                ⚠️ No billing amount configured yet. Contact your Pramukh.
              </Text>
            )}
          </View>

          {/* Period selection */}
          {status?.monthly_amount ? (
            <>
              <Text style={styles.sectionTitle}>Select Advance Period</Text>
              <View style={styles.optionsGrid}>
                {PERIOD_OPTIONS.map((opt) => {
                  const total = opt.months * (status.monthly_amount || 0);
                  const isSelected = selectedMonths === opt.months;
                  return (
                    <TouchableOpacity
                      key={opt.months}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                      onPress={() => setSelectedMonths(opt.months)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.optionIcon}>{opt.icon}</Text>
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.optionAmount, isSelected && styles.optionAmountSelected]}>
                        ₹{total.toLocaleString('en-IN')}
                      </Text>
                      {isSelected && (
                        <View style={styles.selectedCheck}>
                          <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Pay button */}
              <TouchableOpacity
                style={[styles.payBtn, (!selectedMonths || paying) && styles.payBtnDisabled]}
                onPress={payNow}
                disabled={!selectedMonths || paying}
              >
                {paying ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={20} color={Colors.white} />
                    <Text style={styles.payBtnText}>
                      {totalForSelected
                        ? `Pay ₹${totalForSelected.toLocaleString('en-IN')} via Razorpay`
                        : 'Select a period to pay'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.infoText}>
                💡 Your credit will be automatically applied when Pramukh generates future bills.
              </Text>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  content: { padding: 16, paddingBottom: 40 },
  creditCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20,
    marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    borderLeftWidth: 4, borderLeftColor: Colors.primary,
  },
  creditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  creditLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  creditAmount: { fontSize: 28, fontWeight: '800', color: Colors.text },
  monthsCoveredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.success + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  monthsCoveredText: { fontSize: 12, fontWeight: '700', color: Colors.success },
  monthlyAmountText: { fontSize: 13, color: Colors.textMuted },
  noAmountText: { fontSize: 13, color: Colors.warning, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  optionCard: {
    width: '47%', backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 2, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    position: 'relative',
  },
  optionCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  optionIcon: { fontSize: 28, marginBottom: 6 },
  optionLabel: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  optionLabelSelected: { color: Colors.primary },
  optionAmount: { fontSize: 16, fontWeight: '800', color: Colors.textMuted },
  optionAmountSelected: { color: Colors.primary },
  selectedCheck: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: Colors.primary, borderRadius: 10,
  },
  payBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 16,
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  infoText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
