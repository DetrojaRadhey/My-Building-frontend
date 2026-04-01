import React, { useState, useCallback } from 'react';
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
import { Colors } from '../constants/colors';
import api from '../utils/api';
import { API_BASE } from '../constants/api';
import * as WebBrowser from 'expo-web-browser';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MyPaymentsScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  const fetch = async () => {
    try {
      const res = await api.get('/maintenance/payments?mine=true');
      setPayments(res.data);
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

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payment History</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Summary */}
      {!loading && payments.length > 0 && (
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { borderLeftColor: Colors.success }]}>
            <Text style={s.summaryLabel}>Total Paid</Text>
            <Text style={[s.summaryAmount, { color: Colors.success }]}>₹{totalPaid.toLocaleString('en-IN')}</Text>
          </View>
          <View style={[s.summaryCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={s.summaryLabel}>Pending</Text>
            <Text style={[s.summaryAmount, { color: '#F59E0B' }]}>₹{totalPending.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={i => i.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🧾</Text>
              <Text style={s.emptyTitle}>No payment records</Text>
              <Text style={s.emptyText}>Your maintenance bills will appear here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPaid = item.status === 'paid';
            const bill = item.maintenance_bills;
            const isCash = item.payment_method === 'cash';
            return (
              <View style={[s.card, isPaid && s.cardPaid]}>
                <View style={s.cardTop}>
                  <View style={s.monthBox}>
                    <Text style={s.monthText}>{MONTHS[bill?.month]}</Text>
                    <Text style={s.yearText}>{bill?.year}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardAmount}>₹{Number(item.amount).toLocaleString('en-IN')}</Text>
                    {bill?.description ? <Text style={s.cardDesc} numberOfLines={1}>{bill.description}</Text> : null}
                    {bill?.due_date ? <Text style={s.cardDue}>Due: {new Date(bill.due_date).toLocaleDateString('en-IN')}</Text> : null}
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: isPaid ? Colors.success + '20' : '#FEF3C7' }]}>
                    <Text style={[s.statusText, { color: isPaid ? Colors.success : '#D97706' }]}>
                      {isPaid ? (isCash ? 'CASH' : 'PAID') : 'PENDING'}
                    </Text>
                  </View>
                </View>

                {isPaid && item.paid_at ? (
                  <View style={s.paidRow}>
                    <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                    <Text style={s.paidText}>
                      Paid on {new Date(item.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {item.razorpay_payment_id && !isCash ? ` · ${item.razorpay_payment_id}` : ''}
                    </Text>
                  </View>
                ) : null}

                <View style={s.cardActions}>
                  {!isPaid && (
                    <TouchableOpacity
                      style={s.payBtn}
                      onPress={() => payNow(item.id)}
                      disabled={paying === item.id}
                    >
                      {paying === item.id
                        ? <ActivityIndicator size="small" color={Colors.white} />
                        : <Text style={s.payBtnText}>Pay Now</Text>}
                    </TouchableOpacity>
                  )}
                  {isPaid && (
                    <TouchableOpacity
                      style={s.receiptBtn}
                      onPress={() => downloadReceipt(item.id)}
                      disabled={downloading === item.id}
                    >
                      {downloading === item.id
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <>
                            <Ionicons name="download-outline" size={15} color={Colors.primary} />
                            <Text style={s.receiptBtnText}>Receipt</Text>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
});
