import React, { useState, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import { API_BASE } from '../constants/api';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getPaymentActions(
  status: string,
  paymentMethod: string | null
): ('pay_now' | 'mark_cash' | 'upload_receipt')[] {
  if (status !== 'pending' && status !== 'partial') return [];
  const m = paymentMethod ?? 'Online (Payment Gateway)';
  const actions: ('pay_now' | 'mark_cash' | 'upload_receipt')[] = [];
  if (m === 'Online (Payment Gateway)' || m === 'Both Cash & Online' || m === 'Cheque & Online') {
    actions.push('pay_now');
  }
  if (m === 'Cash Only' || m === 'Both Cash & Online') {
    actions.push('mark_cash');
  }
  if (m === 'Cheque' || m === 'Cheque & Online') {
    actions.push('upload_receipt');
  }
  if (actions.length === 0) actions.push('pay_now');
  return actions;
}

export default function MyPaymentsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const [tcExpanded, setTcExpanded] = useState(false);
  const [advanceStatus, setAdvanceStatus] = useState<{
    credit_balance: number;
    months_covered: number;
    monthly_amount: number | null;
  } | null>(null);

  const fetch = async () => {
    try {
      const [paymentsRes, advanceRes] = await Promise.all([
        api.get('/maintenance/payments?mine=true'),
        api.get('/maintenance/advance/status').catch(() => null),
      ]);
      setPayments(paymentsRes.data);
      if (advanceRes) setAdvanceStatus(advanceRes.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetch(); }, []));

  const payNow = async (recordId: string) => {
    setPaying(recordId);
    try {
      const res = await api.post('/maintenance/pay/order', { payment_record_id: recordId });
      const { checkout_url } = res.data;
      await WebBrowser.openBrowserAsync(checkout_url, {
        dismissButtonStyle: 'cancel',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
      fetch(); // refresh after returning
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to initiate payment');
    } finally { setPaying(null); }
  };

  const uploadReceipt = async (recordId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingReceipt(recordId);
    try {
      await api.patch(`/maintenance/payments/${recordId}/receipt`, {
        receipt_url: `data:image/jpeg;base64,${asset.base64}`,
      });
      fetch();
    } catch (e: any) {
      Alert.alert('Upload Failed', e.response?.data?.error || 'Could not upload receipt. Please try again.');
    } finally {
      setUploadingReceipt(null);
    }
  };

  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadReceipt = async (recordId: string) => {
    setDownloading(recordId);
    try {
      const token = await AsyncStorage.getItem('token');
      const url = `${API_BASE}/maintenance/receipt/${recordId}`;
      const localPath = `${FileSystem.cacheDirectory}receipt_${recordId.slice(0, 8)}.pdf`;

      const result = await FileSystem.downloadAsync(url, localPath, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (result.status !== 200) {
        Alert.alert('Error', 'Failed to download receipt. Please try again.');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Receipt',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Downloaded', `Receipt saved to: ${result.uri}`);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Could not download receipt. Check your connection.');
    } finally {
      setDownloading(null);
    }
  };

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.display_amount ?? p.amount), 0);
  const totalPending = payments.filter(p => p.status === 'pending' || p.status === 'partial').reduce((s, p) => s + Number(p.amount_due ?? p.display_amount ?? p.amount), 0);

  const buildingPaymentMethod = payments[0]?.building_payment_method ?? null;
  const buildingPaymentTc = payments[0]?.building_payment_tc ?? null;

  

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('paymentHistory')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Summary */}
      {!loading && payments.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.success }]}>
            <Text style={styles.summaryLabel}>{t('totalPaid')}</Text>
            <Text style={[styles.summaryAmount, { color: Colors.success }]}>₹{totalPaid.toLocaleString('en-IN')}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={styles.summaryLabel}>{t('pending')}</Text>
            <Text style={[styles.summaryAmount, { color: '#F59E0B' }]}>₹{totalPending.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      )}

      {/* Advance credit banner */}
      {!loading && (
        <View style={advanceStyles.advanceBanner}>
          {advanceStatus && advanceStatus.credit_balance > 0 ? (
            <View style={advanceStyles.advanceCreditInfo}>
              <Ionicons name="wallet-outline" size={18} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={advanceStyles.advanceCreditTitle}>
                  ₹{advanceStatus.credit_balance.toLocaleString('en-IN')} advance credit
                </Text>
                {advanceStatus.months_covered > 0 && (
                  <Text style={advanceStyles.advanceCreditSub}>
                    {advanceStatus.months_covered} month{advanceStatus.months_covered > 1 ? 's' : ''} covered
                  </Text>
                )}
              </View>
            </View>
          ) : null}
          <TouchableOpacity
            style={advanceStyles.advanceBtn}
            onPress={() => router.push('/advance-payment')}
          >
            <Ionicons name="add-circle-outline" size={16} color={Colors.white} />
            <Text style={advanceStyles.advanceBtnText}>Pay in Advance</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
          ListHeaderComponent={buildingPaymentTc ? (
            <TouchableOpacity style={styles.tcSection} onPress={() => setTcExpanded(e => !e)} activeOpacity={0.8}>
              <View style={styles.tcHeader}>
                <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
                <Text style={styles.tcTitle}>Payment Terms & Conditions</Text>
                <Ionicons name={tcExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
              </View>
              {tcExpanded && <Text style={styles.tcBody}>{buildingPaymentTc}</Text>}
            </TouchableOpacity>
          ) : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.emptyTitle}>No payment records</Text>
              <Text style={styles.emptyText}>Your maintenance bills will appear here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPaid = item.status === 'paid';
            const isReceiptUploaded = item.status === 'receipt_uploaded';
            const isPartial = item.status === 'partial';
            const bill = item.maintenance_bills;
            const actions = getPaymentActions(item.status, buildingPaymentMethod);
            return (
              <View style={[styles.card, (isPaid || isReceiptUploaded) && styles.cardPaid, isPartial && advanceStyles.cardPartial]}>
                <View style={styles.cardTop}>
                  <View style={styles.monthBox}>
                    <Text style={styles.monthText}>{MONTHS[bill?.month]}</Text>
                    <Text style={styles.yearText}>{bill?.year}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardAmount}>₹{Number(item.display_amount ?? item.amount).toLocaleString('en-IN')}</Text>
                    {item.is_overdue && item.penalty_amount > 0 ? (
                      <Text style={styles.cardDesc}>
                        Bill ₹{Number(item.amount).toLocaleString('en-IN')} + Penalty ₹{Number(item.penalty_amount).toLocaleString('en-IN')}
                      </Text>
                    ) : null}
                    {bill?.description ? <Text style={styles.cardDesc} numberOfLines={1}>{bill.description}</Text> : null}
                    {bill?.due_date ? <Text style={styles.cardDue}>Due: {new Date(bill.due_date).toLocaleDateString('en-IN')}</Text> : null}
                  </View>
                  <View style={[styles.statusBadge, {
                    backgroundColor: isPaid ? Colors.success + '20' : isReceiptUploaded ? Colors.primary + '20' : isPartial ? '#7C3AED20' : '#FEF3C7'
                  }]}>
                    <Text style={[styles.statusText, {
                      color: isPaid ? Colors.success : isReceiptUploaded ? Colors.primary : isPartial ? '#7C3AED' : '#D97706'
                    }]}>
                      {isPaid ? 'PAID' : isReceiptUploaded ? 'SUBMITTED' : isPartial ? 'PARTIAL' : 'PENDING'}
                    </Text>
                  </View>
                </View>

                {isPaid && item.paid_at ? (
                  <View style={styles.paidRow}>
                    <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                    <Text style={styles.paidText}>
                      Paid on {new Date(item.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {item.razorpay_payment_id ? ` · ${item.razorpay_payment_id}` : ''}
                      {item.payment_method === 'advance' ? ' · via advance credit' : ''}
                    </Text>
                  </View>
                ) : null}

                {isPartial ? (
                  <View style={styles.paidRow}>
                    <Ionicons name="wallet-outline" size={13} color="#7C3AED" />
                    <Text style={[styles.paidText, { color: '#7C3AED' }]}>
                      ₹{Number(item.advance_credit_applied || 0).toLocaleString('en-IN')} paid via advance · ₹{Number(item.amount_due || 0).toLocaleString('en-IN')} remaining
                    </Text>
                  </View>
                ) : null}

                {isReceiptUploaded ? (
                  <View style={styles.paidRow}>
                    <Ionicons name="cloud-upload-outline" size={13} color={Colors.primary} />
                    <Text style={[styles.paidText, { color: Colors.primary }]}>Receipt Submitted — awaiting verification</Text>
                  </View>
                ) : null}

                <View style={styles.cardActions}>
                  {actions.includes('pay_now') && (
                    <TouchableOpacity
                      style={styles.payBtn}
                      onPress={() => payNow(item.id)}
                      disabled={paying === item.id}
                    >
                      {paying === item.id
                        ? <ActivityIndicator size="small" color={Colors.white} />
                        : <Text style={styles.payBtnText}>Pay Now</Text>}
                    </TouchableOpacity>
                  )}
                  {actions.includes('mark_cash') && (
                    <TouchableOpacity style={styles.cashBtn} onPress={() => Alert.alert('Cash Payment', 'Please inform your Pramukh about your cash payment.')}>
                      <Text style={styles.cashBtnText}>Mark as Cash</Text>
                    </TouchableOpacity>
                  )}
                  {actions.includes('upload_receipt') && (
                    <TouchableOpacity
                      style={styles.uploadBtn}
                      onPress={() => uploadReceipt(item.id)}
                      disabled={uploadingReceipt === item.id}
                    >
                      {uploadingReceipt === item.id
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <>
                            <Ionicons name="cloud-upload-outline" size={15} color={Colors.primary} />
                            <Text style={styles.uploadBtnText}>Upload Receipt</Text>
                          </>
                      }
                    </TouchableOpacity>
                  )}
                  {isPaid && (
                    <TouchableOpacity
                      style={styles.receiptBtn}
                      onPress={() => downloadReceipt(item.id)}
                      disabled={downloading === item.id}
                    >
                      {downloading === item.id
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <>
                            <Ionicons name="download-outline" size={15} color={Colors.primary} />
                            <Text style={styles.receiptBtnText}>{t('receipt')}</Text>
                          </>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  summaryRow: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 0 },
  summaryCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  summaryLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  summaryAmount: { fontSize: 20, fontWeight: '800' },
  list: { padding: 16 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardPaid: { borderLeftWidth: 3, borderLeftColor: Colors.success },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  monthBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  monthText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  yearText: { fontSize: 10, color: Colors.textMuted },
  cardAmount: { fontSize: 18, fontWeight: '800', color: Colors.text },
  cardDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  cardDue: { fontSize: 11, color: '#F59E0B', marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '800' },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  paidText: { fontSize: 12, color: Colors.success, flex: 1 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  payBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  payBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  receiptBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  tcSection: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  tcHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tcTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.primary },
  tcBody: { fontSize: 13, color: Colors.text, marginTop: 10, lineHeight: 20 },
  cashBtn: { borderWidth: 1.5, borderColor: Colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  cashBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  uploadBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
});

// Appended styles for advance payment feature
const advanceStyles = StyleSheet.create({
  cardPartial: { borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
  advanceBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 4, marginTop: 8,
    backgroundColor: Colors.white, borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  advanceCreditInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  advanceCreditTitle: { fontSize: 13, fontWeight: '700', color: Colors.success },
  advanceCreditSub: { fontSize: 11, color: Colors.textMuted },
  advanceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  advanceBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
});
