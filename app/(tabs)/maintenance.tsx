import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView, Linking
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { API_BASE } from '../../constants/api';
import { useBuildings } from '../../hooks/useBuildings';
import BuildingDropdown from '../../components/BuildingDropdown';
import type { Building } from '../../hooks/useBuildings';
import { useMarkNotificationsRead } from '../../hooks/useMarkNotificationsRead';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function groupByUser(payments: any[]) {
  const map: Record<string, { user: any; records: any[] }> = {};
  for (const p of payments) {
    const uid = p.user_id;
    if (!map[uid]) map[uid] = { user: p.users, records: [] };
    map[uid].records.push(p);
  }
  return Object.values(map).sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || ''));
}

export default function MaintenanceScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh' || isAdmin;
  const isUser = user?.role === 'user';

  useMarkNotificationsRead(['bill', 'payment', 'reminder']);
  const params = useLocalSearchParams<{ building_id?: string; building_name?: string }>();

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  useEffect(() => {
    if (params.building_id && params.building_name && isAdmin) {
      setSelectedBuilding({ id: params.building_id, name: params.building_name });
    }
  }, [params.building_id]);

  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddBill, setShowAddBill] = useState(false);
  const [billForm, setBillForm] = useState({
    amount: '', month: '', year: new Date().getFullYear().toString(), due_date: '', description: ''
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dpYear, setDpYear] = useState(new Date().getFullYear());
  const [dpMonth, setDpMonth] = useState(new Date().getMonth() + 1);
  const [submitting, setSubmitting] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [cashingId, setCashingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{ user: any; records: any[] } | null>(null);

  useFocusEffect(useCallback(() => { fetchPayments(); }, [selectedBuilding]));

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const url = event.url;
      if (!url.startsWith('mybuilding://payment')) return;
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const status = urlParams.get('status');
      if (status === 'success') {
        router.replace('/maintenance' as any);
        fetchPayments();
        Alert.alert('Payment Successful', 'Your maintenance payment has been recorded.');
      } else if (status === 'failed') {
        Alert.alert('Payment Failed', 'Payment could not be verified. Please try again.');
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  const fetchPayments = async () => {
    try {
      const buildingId = isAdmin ? selectedBuilding?.id : undefined;
      const url = buildingId ? `/maintenance/payments?building_id=${buildingId}` : '/maintenance/payments';
      const res = await api.get(url);
      setPayments(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const addBill = async () => {
    if (isAdmin && !selectedBuilding) return Alert.alert('Error', 'Please select a building first');
    if (!billForm.amount || !billForm.month || !billForm.year)
      return Alert.alert('Error', 'Amount, month and year are required');
    const parsedAmount = parseFloat(billForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return Alert.alert('Error', 'Amount must be a positive number');
    const parsedMonth = parseInt(billForm.month);
    if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) return Alert.alert('Error', 'Month must be between 1 and 12');
    const parsedYear = parseInt(billForm.year);
    if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) return Alert.alert('Error', 'Please enter a valid year');
    setSubmitting(true);
    try {
      await api.post('/maintenance/bills', {
        amount: Number(billForm.amount), month: Number(billForm.month), year: Number(billForm.year),
        due_date: billForm.due_date || undefined, description: billForm.description || undefined,
        ...(isAdmin && selectedBuilding ? { building_id: selectedBuilding.id } : {}),
      });
      setShowAddBill(false);
      setBillForm({ amount: '', month: '', year: new Date().getFullYear().toString(), due_date: '', description: '' });
      fetchPayments();
      Alert.alert('Success', 'Bill added and members notified');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to add bill');
    } finally {
      setSubmitting(false);
    }
  };

  const initiatePayment = async (record: any) => {
    setPayingId(record.id);
    try {
      const res = await api.post('/maintenance/pay/order', { payment_record_id: record.id });
      await WebBrowser.openBrowserAsync(res.data.checkout_url, {
        dismissButtonStyle: 'cancel',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
      fetchPayments();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setPayingId(null);
    }
  };

  const markCashPaid = async (record: any) => {
    Alert.alert(
      'Mark as Cash Paid',
      `Confirm cash payment of ₹${Number(record.maintenance_bills?.amount).toLocaleString('en-IN')} for ${record.users?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: async () => {
            setCashingId(record.id);
            try {
              await api.post('/maintenance/pay/cash', { payment_record_id: record.id });
              Alert.alert('Done', 'Cash payment recorded');
              fetchPayments();
              if (selectedUser) {
                setSelectedUser((prev) => prev ? {
                  ...prev,
                  records: prev.records.map((r) => r.id === record.id
                    ? { ...r, status: 'paid', payment_method: 'cash', paid_at: new Date().toISOString() }
                    : r)
                } : null);
              }
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error || 'Failed');
            } finally {
              setCashingId(null);
            }
          },
        },
      ]
    );
  };

  const downloadReceipt = async (record: any) => {
    const url = `${API_BASE}/maintenance/receipt/${record.id}?token=${token}`;
    try { await Linking.openURL(url); } catch { Alert.alert('Error', 'Could not open receipt'); }
  };

  const sendReminder = async () => {
    if (isAdmin && !selectedBuilding) return Alert.alert('Select Building', 'Please select a building first');
    try {
      await api.post('/maintenance/reminder', {
        ...(isAdmin && selectedBuilding ? { building_id: selectedBuilding.id } : {}),
      });
      Alert.alert('Done', 'Reminders sent to all pending members');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to send reminders');
    }
  };

  const renderBillCard = (item: any, showCashBtn: boolean) => {
    const bill = item.maintenance_bills;
    const isPaid = item.status === 'paid';
    const isCash = item.payment_method === 'cash';
    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardPeriod}>{MONTHS[bill?.month]} {bill?.year}</Text>
            {bill?.description ? <Text style={styles.cardDesc}>{bill.description}</Text> : null}
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.cardAmount}>₹{Number(bill?.amount).toLocaleString('en-IN')}</Text>
            <View style={[styles.statusBadge, { backgroundColor: isPaid ? Colors.success + '20' : Colors.danger + '20' }]}>
              <Text style={[styles.statusText, { color: isPaid ? Colors.success : Colors.danger }]}>
                {isPaid ? 'Paid' : 'Pending'}
              </Text>
            </View>
            {isPaid && (
              <View style={[styles.statusBadge, { backgroundColor: isCash ? '#78350f20' : Colors.primary + '15' }]}>
                <Text style={[styles.statusText, { color: isCash ? '#92400e' : Colors.primary }]}>
                  {isCash ? '💵 Cash' : '💳 Online'}
                </Text>
              </View>
            )}
          </View>
        </View>
        {bill?.due_date && !isPaid ? <Text style={styles.dueDate}>Due: {bill.due_date}</Text> : null}
        {isPaid && item.paid_at ? <Text style={styles.paidAt}>Paid on {new Date(item.paid_at).toLocaleDateString('en-IN')}</Text> : null}
        <View style={styles.cardActions}>
          {!isPaid && (isUser || (user?.role === 'pramukh' && item.user_id === user?.id)) && (
            <TouchableOpacity style={styles.payBtn} onPress={() => initiatePayment(item)} disabled={payingId === item.id}>
              {payingId === item.id
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="card" size={16} color={Colors.white} /><Text style={styles.payBtnText}>Pay Online</Text></>}
            </TouchableOpacity>
          )}
          {!isPaid && showCashBtn && (user?.role === 'pramukh' || isAdmin) && item.user_id !== user?.id && (
            <TouchableOpacity style={styles.cashBtn} onPress={() => markCashPaid(item)} disabled={cashingId === item.id}>
              {cashingId === item.id
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="cash" size={16} color={Colors.white} /><Text style={styles.cashBtnText}>Mark Cash Paid</Text></>}
            </TouchableOpacity>
          )}
          {isPaid && (
            <TouchableOpacity style={styles.receiptBtn} onPress={() => downloadReceipt(item)}>
              <Ionicons name="document-text" size={16} color={Colors.primary} />
              <Text style={styles.receiptBtnText}>Receipt</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const myBills = user?.role === 'pramukh' ? payments.filter((p) => p.user_id === user.id) : [];
  const memberPayments = user?.role === 'pramukh' ? payments.filter((p) => p.user_id !== user.id) : payments;
  const grouped = groupByUser(memberPayments);

  const renderUserRow = ({ item }: { item: { user: any; records: any[] } }) => {
    const pending = item.records.filter((r) => r.status === 'pending').length;
    const paid = item.records.filter((r) => r.status === 'paid').length;
    return (
      <TouchableOpacity style={styles.userRow} onPress={() => setSelectedUser(item)} activeOpacity={0.75}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{item.user?.name?.[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{item.user?.name || 'Unknown'}</Text>
          <Text style={styles.userMeta}>Flat {item.user?.flat_no || '—'} • {item.records.length} bill{item.records.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {pending > 0 && (
            <View style={[styles.statusBadge, { backgroundColor: Colors.danger + '20' }]}>
              <Text style={[styles.statusText, { color: Colors.danger }]}>{pending} Pending</Text>
            </View>
          )}
          {paid > 0 && (
            <View style={[styles.statusBadge, { backgroundColor: Colors.success + '20' }]}>
              <Text style={[styles.statusText, { color: Colors.success }]}>{paid} Paid</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Maintenance</Text>
        <View style={styles.headerActions}>
          {isPramukh && (
            <>
              <TouchableOpacity style={styles.headerBtn} onPress={sendReminder}>
                <Ionicons name="notifications" size={18} color={Colors.white} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={() => setShowAddBill(true)}>
                <Ionicons name="add" size={22} color={Colors.white} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown buildings={buildings} loading={buildingsLoading} selected={selectedBuilding} onSelect={setSelectedBuilding} label="Filter by Building" />
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : isUser ? (
        <FlatList
          data={payments}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => renderBillCard(item, false)}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayments(); }} />}
          ListEmptyComponent={<Text style={styles.empty}>No maintenance bills yet</Text>}
        />
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(i) => i.user?.id || Math.random().toString()}
          renderItem={renderUserRow}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayments(); }} />}
          ListHeaderComponent={
            myBills.length > 0 ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.sectionLabel}>My Bills</Text>
                {myBills.map((item) => renderBillCard(item, false))}
                <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Members</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isAdmin && !selectedBuilding ? 'Select a building to view bills' : 'No maintenance bills yet'}
            </Text>
          }
        />
      )}

      {/* User detail modal */}
      <Modal visible={!!selectedUser} animationType="slide" presentationStyle="pageSheet">
        {selectedUser && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedUser.user?.name}</Text>
                <Text style={styles.modalSub}>Flat {selectedUser.user?.flat_no || '—'}{selectedUser.user?.phone ? ` • ${selectedUser.user.phone}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {selectedUser.records.map((r) => renderBillCard(r, true))}
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Add Bill Modal */}
      <Modal visible={showAddBill} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Monthly Bill</Text>
            <TouchableOpacity onPress={() => setShowAddBill(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {isAdmin && (
              <BuildingDropdown buildings={buildings} loading={buildingsLoading} selected={selectedBuilding} onSelect={setSelectedBuilding} label="Select Building *" />
            )}
            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput style={styles.input} value={billForm.amount} onChangeText={(v) => setBillForm({ ...billForm, amount: v })} placeholder="e.g. 2000" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Month (1-12) *</Text>
            <TextInput style={styles.input} value={billForm.month} onChangeText={(v) => setBillForm({ ...billForm, month: v })} placeholder="e.g. 3 for March" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Year *</Text>
            <TextInput style={styles.input} value={billForm.year} onChangeText={(v) => setBillForm({ ...billForm, year: v })} keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Due Date</Text>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => {
              if (billForm.due_date) {
                const [y, m] = billForm.due_date.split('-');
                setDpYear(Number(y)); setDpMonth(Number(m));
              }
              setShowDatePicker(v => !v);
            }}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
              <Text style={[styles.datePickerText, !billForm.due_date && { color: Colors.textMuted }]}>
                {billForm.due_date || 'Select due date'}
              </Text>
              {billForm.due_date ? (
                <TouchableOpacity onPress={() => { setBillForm({ ...billForm, due_date: '' }); setShowDatePicker(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
              )}
            </TouchableOpacity>

            {showDatePicker && (
              <View style={styles.dpInline}>
                <View style={styles.dpNav}>
                  <TouchableOpacity onPress={() => { if (dpMonth === 1) { setDpMonth(12); setDpYear(y => y - 1); } else setDpMonth(m => m - 1); }} style={styles.dpNavBtn}>
                    <Ionicons name="chevron-back" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.dpNavLabel}>{MONTHS[dpMonth]} {dpYear}</Text>
                  <TouchableOpacity onPress={() => { if (dpMonth === 12) { setDpMonth(1); setDpYear(y => y + 1); } else setDpMonth(m => m + 1); }} style={styles.dpNavBtn}>
                    <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.dpRow}>
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <Text key={d} style={styles.dpDayHeader}>{d}</Text>
                  ))}
                </View>
                {(() => {
                  const firstDay = new Date(dpYear, dpMonth - 1, 1).getDay();
                  const daysInMonth = new Date(dpYear, dpMonth, 0).getDate();
                  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
                  while (cells.length % 7 !== 0) cells.push(null);
                  const today = new Date();
                  return Array.from({ length: cells.length / 7 }, (_, row) => (
                    <View key={row} style={styles.dpRow}>
                      {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                        if (!day) return <View key={col} style={styles.dpCell} />;
                        const dateStr = `${dpYear}-${String(dpMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                        const isSelected = billForm.due_date === dateStr;
                        const isToday = dpYear === today.getFullYear() && dpMonth === today.getMonth() + 1 && day === today.getDate();
                        return (
                          <TouchableOpacity key={col} style={[styles.dpCell, isSelected && styles.dpCellSelected, isToday && !isSelected && styles.dpCellToday]}
                            onPress={() => { setBillForm(f => ({ ...f, due_date: dateStr })); setShowDatePicker(false); }}>
                            <Text style={[styles.dpDayText, isSelected && styles.dpDayTextSelected, isToday && !isSelected && styles.dpDayTextToday]}>{day}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ));
                })()}
              </View>
            )}
            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} value={billForm.description} onChangeText={(v) => setBillForm({ ...billForm, description: v })} placeholder="Optional note" placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={styles.submitBtn} onPress={addBill} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add Bill & Notify Members</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Date Picker Modal — replaced with inline calendar inside Add Bill modal */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 8 },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  userRow: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userAvatarText: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  userName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  userMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardPeriod: { fontSize: 16, fontWeight: '700', color: Colors.text },
  cardDesc: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardAmount: { fontSize: 20, fontWeight: '800', color: Colors.text },
  statusBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  dueDate: { fontSize: 12, color: Colors.warning, marginTop: 8, fontWeight: '600' },
  paidAt: { fontSize: 12, color: Colors.success, marginTop: 6, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.success, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  payBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  cashBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#92400e', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  cashBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  receiptBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 60, fontSize: 16 },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, backgroundColor: Colors.bg },
  datePickerText: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '500' },
  dpInline: { backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, padding: 12, marginTop: 8 },
  dpNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  dpNavBtn: { padding: 6 },
  dpNavLabel: { fontSize: 16, fontWeight: '800', color: Colors.text },
  dpRow: { flexDirection: 'row' },
  dpDayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted, paddingVertical: 4 },
  dpCell: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, margin: 1 },
  dpCellSelected: { backgroundColor: Colors.primary },
  dpCellToday: { backgroundColor: Colors.primary + '18' },
  dpDayText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  dpDayTextSelected: { color: Colors.white, fontWeight: '800' },
  dpDayTextToday: { color: Colors.primary, fontWeight: '800' },
});
