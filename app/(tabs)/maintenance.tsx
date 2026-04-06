import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView, Linking,
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
import { useActivityLog } from '../../hooks/useActivityLog';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function groupByUser(payments: any[]) {
  const map: Record<string, { user: any; records: any[] }> = {};
  for (const p of payments) {
    const uid = p.user_id;
    if (!map[uid]) map[uid] = { user: p.users, records: [] };
    map[uid].records.push(p);
  }
  return Object.values(map).sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || ''));
}

type Tab = 'my-bills' | 'members' | 'bills';

export default function MaintenanceScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { logEvent } = useActivityLog();
  const isAdmin = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh' || isAdmin;
  const isUser = user?.role === 'user';

  useMarkNotificationsRead(['bill', 'payment', 'reminder']);
  const params = useLocalSearchParams<{ building_id?: string; building_name?: string }>();
  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  useEffect(() => {
    if (params.building_id && params.building_name && isAdmin)
      setSelectedBuilding({ id: params.building_id, name: params.building_name });
  }, [params.building_id]);

  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(isPramukh ? 'my-bills' : 'my-bills');
  const [showAddBill, setShowAddBill] = useState(false);
  const [billForm, setBillForm] = useState({
    amount: '', month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()), due_date: '', description: '', penalty_amount: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dpYear, setDpYear] = useState(new Date().getFullYear());
  const [dpMonth, setDpMonth] = useState(new Date().getMonth() + 1);
  const [submitting, setSubmitting] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{ user: any; records: any[] } | null>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [showEditBill, setShowEditBill] = useState<any>(null);
  const [editForm, setEditForm] = useState({ penalty_amount: '', description: '', due_date: '' });
  const [billSubTab, setBillSubTab] = useState<'current' | 'paid'>('current');

  useFocusEffect(useCallback(() => { fetchPayments(); fetchBills(); logEvent('open_maintenance', 'maintenance'); }, [selectedBuilding]));

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      if (!event.url.startsWith('mybuilding://payment')) return;
      const p = new URLSearchParams(event.url.split('?')[1]);
      if (p.get('status') === 'success') {
        fetchPayments();
        Alert.alert('✅ Payment Successful', 'Your maintenance payment has been recorded.');
      } else if (p.get('status') === 'failed') {
        Alert.alert('Payment Failed', 'Please try again.');
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
    } finally { setLoading(false); setRefreshing(false); }
  };

  const fetchBills = async () => {
    try {
      const buildingId = isAdmin ? selectedBuilding?.id : undefined;
      const url = buildingId ? `/maintenance/bills?building_id=${buildingId}` : '/maintenance/bills';
      const res = await api.get(url);
      setBills(res.data);
    } catch {}
  };

  const openEditBill = (bill: any) => {
    setEditForm({
      penalty_amount: bill.penalty_amount ? String(bill.penalty_amount) : '',
      description: bill.description || '',
      due_date: bill.due_date || '',
    });
    setShowEditBill(bill);
  };

  const saveEditBill = async () => {
    if (!showEditBill) return;
    setSubmitting(true);
    try {
      await api.patch('/maintenance/bills', {
        bill_id: showEditBill.id,
        penalty_amount: editForm.penalty_amount ? Number(editForm.penalty_amount) : 0,
        description: editForm.description || undefined,
        due_date: editForm.due_date || undefined,
      });
      setShowEditBill(null);
      fetchBills();
      fetchPayments();
      Alert.alert('Done', 'Bill updated');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  const addBill = async () => {
    if (isAdmin && !selectedBuilding) return Alert.alert('Error', 'Select a building first');
    if (!billForm.amount || !billForm.month || !billForm.year)
      return Alert.alert('Error', 'Amount, month and year are required');
    const parsedAmount = parseFloat(billForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return Alert.alert('Error', 'Amount must be positive');
    const parsedMonth = parseInt(billForm.month);
    if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) return Alert.alert('Error', 'Month must be 1–12');
    setSubmitting(true);
    try {
      await api.post('/maintenance/bills', {
        amount: parsedAmount, month: parsedMonth, year: Number(billForm.year),
        due_date: billForm.due_date || undefined,
        description: billForm.description || undefined,
        penalty_amount: billForm.penalty_amount ? Number(billForm.penalty_amount) : undefined,
        ...(isAdmin && selectedBuilding ? { building_id: selectedBuilding.id } : {}),
      });
      setShowAddBill(false);
      setBillForm({ amount: '', month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()), due_date: '', description: '', penalty_amount: '' });
      fetchPayments();
      Alert.alert('Done', 'Bill added and members notified');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  const initiatePayment = async (record: any) => {
    setPayingId(record.id);
    const bill = record.maintenance_bills;
    logEvent('tap_pay_bill', 'maintenance', {
      record_id: record.id,
      amount: record.amount,
      total_amount: record.total_amount,
      period: bill ? `${bill.month}/${bill.year}` : undefined,
      status: record.status,
    });
    try {
      const res = await api.post('/maintenance/pay/order', { payment_record_id: record.id });
      logEvent('payment_initiated', 'maintenance', {
        record_id: record.id,
        amount: res.data.total_amount,
        bill_period: bill ? `${bill.month}/${bill.year}` : undefined,
      });
      await WebBrowser.openBrowserAsync(res.data.checkout_url, {
        dismissButtonStyle: 'cancel',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
      fetchPayments();
    } catch (e: any) {
      logEvent('payment_initiation_failed', 'maintenance', { record_id: record.id, error: e.response?.data?.error });
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setPayingId(null); }
  };

  const downloadReceipt = async (record: any) => {
    logEvent('download_receipt', 'maintenance', { record_id: record.id });
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
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const myBills = useMemo(() =>
    isPramukh ? payments.filter(p => p.user_id === user?.id) : payments,
    [payments, user?.id]
  );
  const memberPayments = useMemo(() =>
    isPramukh ? payments.filter(p => p.user_id !== user?.id) : [],
    [payments, user?.id]
  );
  const grouped = useMemo(() => groupByUser(memberPayments), [memberPayments]);

  // Stats for Bills tab
  const billStats = useMemo(() => {
    const total = payments.length;
    const paid = payments.filter(p => p.status === 'paid').length;
    const pending = total - paid;
    const totalAmt = payments.reduce((s, p) => s + Number(p.total_amount || p.amount), 0);
    const collectedAmt = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.total_amount || p.amount), 0);
    return { total, paid, pending, totalAmt, collectedAmt };
  }, [payments]);

  // ── Bill card ─────────────────────────────────────────────────────────────
  const renderBillCard = (item: any) => {
    const bill = item.maintenance_bills;
    const isPaid = item.status === 'paid';
    const penaltyAmount = Number(item.penalty_amount || bill?.penalty_amount || 0);
    const dueDate = bill?.due_date;
    const isOverdue = !isPaid && dueDate && new Date(dueDate) < new Date();
    const totalDue = isPaid
      ? Number(item.total_amount || item.amount)
      : Number(item.amount) + (isOverdue && penaltyAmount > 0 ? penaltyAmount : 0);

    return (
      <View style={[styles.billCard, isPaid && styles.billCardPaid]}>
        {/* Left accent */}
        <View style={[styles.billAccent, { backgroundColor: isPaid ? Colors.success : isOverdue ? '#DC2626' : Colors.primary }]} />
        <View style={styles.billBody}>
          <View style={styles.billTop}>
            <View style={styles.billPeriodBox}>
              <Text style={styles.billMonth}>{SHORT_MONTHS[bill?.month]}</Text>
              <Text style={styles.billYear}>{bill?.year}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.billAmount}>₹{totalDue.toLocaleString('en-IN')}</Text>
              {isOverdue && penaltyAmount > 0 && (
                <Text style={styles.penaltyNote}>₹{Number(item.amount).toLocaleString('en-IN')} + ₹{penaltyAmount} penalty</Text>
              )}
              {bill?.description ? <Text style={styles.billDesc} numberOfLines={1}>{bill.description}</Text> : null}
            </View>
            <View style={[styles.statusPill, { backgroundColor: isPaid ? Colors.success + '18' : isOverdue ? '#FEF2F2' : Colors.danger + '18' }]}>
              <Text style={[styles.statusPillText, { color: isPaid ? Colors.success : isOverdue ? '#DC2626' : Colors.danger }]}>
                {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
              </Text>
            </View>
          </View>

          {dueDate && !isPaid && (
            <Text style={[styles.dueDateText, isOverdue && { color: '#DC2626' }]}>
              {isOverdue ? '⚠️ Was due ' : '📅 Due '}{new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          )}
          {isPaid && item.paid_at && (
            <Text style={styles.paidAtText}>✓ Paid {new Date(item.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          )}

          <View style={styles.billActions}>
            {!isPaid && (isUser || (user?.role === 'pramukh' && item.user_id === user?.id)) && (
              <TouchableOpacity style={styles.payBtn} onPress={() => initiatePayment(item)} disabled={payingId === item.id}>
                {payingId === item.id
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Ionicons name="card-outline" size={15} color={Colors.white} />
                    <Text style={styles.payBtnText}>Pay ₹{totalDue.toLocaleString('en-IN')}</Text></>}
              </TouchableOpacity>
            )}
            {isPaid && (
              <TouchableOpacity style={styles.receiptBtn} onPress={() => downloadReceipt(item)}>
                <Ionicons name="download-outline" size={15} color={Colors.primary} />
                <Text style={styles.receiptBtnText}>Receipt</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ── Member row ────────────────────────────────────────────────────────────
  const renderMemberRow = ({ item }: { item: { user: any; records: any[] } }) => {
    const pending = item.records.filter(r => r.status === 'pending').length;
    const paid = item.records.filter(r => r.status === 'paid').length;
    const overdue = item.records.filter(r => {
      const d = r.maintenance_bills?.due_date;
      return r.status === 'pending' && d && new Date(d) < new Date();
    }).length;
    return (
      <TouchableOpacity style={styles.memberRow} onPress={() => setSelectedUser(item)} activeOpacity={0.8}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>{item.user?.name?.[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>{item.user?.name || 'Unknown'}</Text>
          <Text style={styles.memberMeta}>
            {item.user?.flat_no ? `Flat ${item.user.flat_no}` : 'No flat'} · {item.records.length} bill{item.records.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.memberBadges}>
          {overdue > 0 && <View style={[styles.badge, { backgroundColor: '#FEF2F2' }]}><Text style={[styles.badgeText, { color: '#DC2626' }]}>{overdue} overdue</Text></View>}
          {pending > 0 && <View style={[styles.badge, { backgroundColor: Colors.warning + '20' }]}><Text style={[styles.badgeText, { color: Colors.warning }]}>{pending} pending</Text></View>}
          {paid > 0 && <View style={[styles.badge, { backgroundColor: Colors.success + '18' }]}><Text style={[styles.badgeText, { color: Colors.success }]}>{paid} paid</Text></View>}
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const tabs: { key: Tab; label: string; icon: string }[] = isPramukh
    ? [
        { key: 'my-bills', label: 'My Bills', icon: 'receipt-outline' },
        { key: 'members', label: 'Members', icon: 'people-outline' },
        { key: 'bills', label: 'Bills', icon: 'document-text-outline' },
      ]
    : [{ key: 'my-bills', label: 'My Bills', icon: 'receipt-outline' }];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Maintenance</Text>
          {isPramukh && <Text style={styles.headerSub}>{billStats.pending} pending · {billStats.paid} paid</Text>}
        </View>
        <View style={styles.headerActions}>
          {isPramukh && (
            <TouchableOpacity style={styles.headerBtn} onPress={sendReminder}>
              <Ionicons name="notifications-outline" size={18} color={Colors.white} />
            </TouchableOpacity>
          )}
          {isPramukh && (
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowAddBill(true)}>
              <Ionicons name="add" size={22} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Admin building selector */}
      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown buildings={buildings} loading={buildingsLoading}
            selected={selectedBuilding} onSelect={setSelectedBuilding} label="Filter by Building" />
        </View>
      )}

      {/* Tab bar — only for pramukh */}
      {isPramukh && (
        <View style={styles.tabBar}>
          {tabs.map(t => (
            <TouchableOpacity key={t.key} style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}>
              <Ionicons name={t.icon as any} size={16} color={activeTab === t.key ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : (
        <>
          {/* ── MY BILLS tab ── */}
          {activeTab === 'my-bills' && (() => {
            const pendingBills = myBills.filter(p => p.status !== 'paid');
            const paidBills = myBills.filter(p => p.status === 'paid');
            const totalDue = pendingBills.reduce((s, p) => {
              const bill = p.maintenance_bills;
              const penalty = Number(p.penalty_amount || bill?.penalty_amount || 0);
              const dueDate = bill?.due_date;
              const isOverdue = dueDate && new Date(dueDate) < new Date();
              return s + Number(p.amount) + (isOverdue && penalty > 0 ? penalty : 0);
            }, 0);
            const totalPaid = paidBills.reduce((s, p) => s + Number(p.total_amount || p.amount), 0);
            const activeBillTab = billSubTab;
            const displayBills = activeBillTab === 'current' ? pendingBills : paidBills;

            return (
              <View style={{ flex: 1 }}>
                {/* Summary banner */}
                <View style={styles.summaryBanner}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>₹{totalDue.toLocaleString('en-IN')}</Text>
                    <Text style={styles.summaryLabel}>Amount Due</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: '#86efac' }]}>₹{totalPaid.toLocaleString('en-IN')}</Text>
                    <Text style={styles.summaryLabel}>Total Paid</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{myBills.length}</Text>
                    <Text style={styles.summaryLabel}>Total Bills</Text>
                  </View>
                </View>

                {/* Current / Paid switcher */}
                <View style={styles.billSubTabRow}>
                  <TouchableOpacity
                    style={[styles.billSubTab, activeBillTab === 'current' && styles.billSubTabActive]}
                    onPress={() => setBillSubTab('current')}
                  >
                    <Ionicons
                      name="time-outline"
                      size={15}
                      color={activeBillTab === 'current' ? Colors.white : Colors.danger}
                    />
                    <Text style={[styles.billSubTabText, activeBillTab === 'current' && styles.billSubTabTextActive]}>
                      Current Bills
                    </Text>
                    {pendingBills.length > 0 && (
                      <View style={[styles.billSubTabBadge, { backgroundColor: activeBillTab === 'current' ? 'rgba(255,255,255,0.3)' : Colors.danger }]}>
                        <Text style={styles.billSubTabBadgeText}>{pendingBills.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.billSubTab, activeBillTab === 'paid' && styles.billSubTabPaidActive]}
                    onPress={() => setBillSubTab('paid')}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={15}
                      color={activeBillTab === 'paid' ? Colors.white : Colors.success}
                    />
                    <Text style={[styles.billSubTabText, { color: activeBillTab === 'paid' ? Colors.white : Colors.success }, activeBillTab === 'paid' && styles.billSubTabTextActive]}>
                      Paid Bills
                    </Text>
                    {paidBills.length > 0 && (
                      <View style={[styles.billSubTabBadge, { backgroundColor: activeBillTab === 'paid' ? 'rgba(255,255,255,0.3)' : Colors.success }]}>
                        <Text style={styles.billSubTabBadgeText}>{paidBills.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={displayBills}
                  keyExtractor={i => i.id}
                  renderItem={({ item }) => renderBillCard(item)}
                  contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayments(); }} />}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <Ionicons
                        name={activeBillTab === 'current' ? 'receipt-outline' : 'checkmark-circle-outline'}
                        size={52}
                        color={Colors.border}
                      />
                      <Text style={styles.emptyText}>
                        {activeBillTab === 'current' ? 'No pending bills' : 'No paid bills yet'}
                      </Text>
                    </View>
                  }
                />
              </View>
            );
          })()}

          {/* ── MEMBERS tab ── */}
          {activeTab === 'members' && (
            <FlatList
              data={grouped}
              keyExtractor={i => i.user?.id || Math.random().toString()}
              renderItem={renderMemberRow}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayments(); }} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={52} color={Colors.border} />
                  <Text style={styles.emptyText}>No members found</Text>
                </View>
              }
            />
          )}

          {/* ── BILLS tab ── */}
          {activeTab === 'bills' && (
            <FlatList
              data={bills}
              keyExtractor={i => i.id}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBills(); fetchPayments(); }} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="document-text-outline" size={52} color={Colors.border} />
                  <Text style={styles.emptyText}>No bills created yet</Text>
                  <Text style={styles.emptyHint}>Tap + to add a new bill</Text>
                </View>
              }
              renderItem={({ item }) => {
                const paidCount = payments.filter(p => p.bill_id === item.id && p.status === 'paid').length;
                const totalCount = payments.filter(p => p.bill_id === item.id).length;
                const pendingCount = totalCount - paidCount;
                const isEdited = item.is_edited;
                return (
                  <TouchableOpacity
                    style={styles.billListCard}
                    onPress={() => openEditBill(item)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.billListLeft}>
                      <View style={styles.billPeriodBox}>
                        <Text style={styles.billMonth}>{SHORT_MONTHS[item.month]}</Text>
                        <Text style={styles.billYear}>{item.year}</Text>
                      </View>
                    </View>
                    <View style={styles.billListInfo}>
                      <View style={styles.billListTop}>
                        <Text style={styles.billListAmount}>₹{Number(item.amount).toLocaleString('en-IN')}</Text>
                        {item.penalty_amount > 0 && (
                          <View style={styles.penaltyChip}>
                            <Text style={styles.penaltyChipText}>+₹{item.penalty_amount} penalty</Text>
                          </View>
                        )}
                        {isEdited && (
                          <View style={styles.editedChip}>
                            <Ionicons name="pencil" size={10} color="#7C3AED" />
                            <Text style={styles.editedChipText}>Edited</Text>
                          </View>
                        )}
                      </View>
                      {item.description ? <Text style={styles.billDesc} numberOfLines={1}>{item.description}</Text> : null}
                      {item.due_date && (
                        <Text style={styles.dueDateText}>📅 Due {new Date(item.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                      )}
                      <View style={styles.billListStats}>
                        <View style={[styles.badge, { backgroundColor: Colors.success + '18' }]}>
                          <Text style={[styles.badgeText, { color: Colors.success }]}>{paidCount} paid</Text>
                        </View>
                        {pendingCount > 0 && (
                          <View style={[styles.badge, { backgroundColor: Colors.danger + '18' }]}>
                            <Text style={[styles.badgeText, { color: Colors.danger }]}>{pendingCount} pending</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Ionicons name="create-outline" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </>
      )}

      {/* ── Member detail modal ── */}
      <Modal visible={!!selectedUser} animationType="slide" presentationStyle="pageSheet">
        {selectedUser && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{selectedUser.user?.name?.[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>{selectedUser.user?.name}</Text>
                <Text style={styles.modalSub}>
                  {selectedUser.user?.flat_no ? `Flat ${selectedUser.user.flat_no}` : ''}
                  {selectedUser.user?.phone ? ` · ${selectedUser.user.phone}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedUser.records.map(r => (
                <View key={r.id}>
                  {renderBillCard(r)}
                </View>
              ))}
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ── Edit Bill modal ── */}
      <Modal visible={!!showEditBill} animationType="slide" presentationStyle="pageSheet">
        {showEditBill && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Bill</Text>
                <Text style={styles.modalSub}>{MONTHS[showEditBill.month]} {showEditBill.year} · ₹{Number(showEditBill.amount).toLocaleString('en-IN')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditBill(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Late Penalty (₹) <Text style={styles.optional}>optional</Text></Text>
              <TextInput style={styles.input} value={editForm.penalty_amount}
                onChangeText={v => setEditForm({ ...editForm, penalty_amount: v })}
                placeholder="e.g. 50 — charged after due date" keyboardType="numeric"
                placeholderTextColor={Colors.textMuted} />

              <Text style={styles.label}>Due Date</Text>
              <TextInput style={styles.input} value={editForm.due_date}
                onChangeText={v => setEditForm({ ...editForm, due_date: v })}
                placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />

              <Text style={styles.label}>Description <Text style={styles.optional}>optional</Text></Text>
              <TextInput style={styles.input} value={editForm.description}
                onChangeText={v => setEditForm({ ...editForm, description: v })}
                placeholder="e.g. April maintenance" placeholderTextColor={Colors.textMuted} />

              <TouchableOpacity style={styles.submitBtn} onPress={saveEditBill} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* ── Add Bill modal ── */}
      <Modal visible={showAddBill} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Maintenance Bill</Text>
            <TouchableOpacity onPress={() => setShowAddBill(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {isAdmin && <BuildingDropdown buildings={buildings} loading={buildingsLoading} selected={selectedBuilding} onSelect={setSelectedBuilding} label="Select Building *" />}

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Month *</Text>
                <TextInput style={styles.input} value={billForm.month} onChangeText={v => setBillForm({ ...billForm, month: v })}
                  placeholder="1–12" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Year *</Text>
                <TextInput style={styles.input} value={billForm.year} onChangeText={v => setBillForm({ ...billForm, year: v })}
                  keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
              </View>
            </View>

            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput style={styles.input} value={billForm.amount} onChangeText={v => setBillForm({ ...billForm, amount: v })}
              placeholder="e.g. 2000" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Late Penalty (₹) <Text style={styles.optional}>optional — charged after due date</Text></Text>
            <TextInput style={styles.input} value={billForm.penalty_amount} onChangeText={v => setBillForm({ ...billForm, penalty_amount: v })}
              placeholder="e.g. 50" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Due Date</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => {
              if (billForm.due_date) { const [y, m] = billForm.due_date.split('-'); setDpYear(Number(y)); setDpMonth(Number(m)); }
              setShowDatePicker(v => !v);
            }}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
              <Text style={[styles.dateBtnText, !billForm.due_date && { color: Colors.textMuted }]}>
                {billForm.due_date || 'Select due date'}
              </Text>
              {billForm.due_date
                ? <TouchableOpacity onPress={() => { setBillForm({ ...billForm, due_date: '' }); setShowDatePicker(false); }}>
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                : <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />}
            </TouchableOpacity>

            {showDatePicker && (
              <View style={styles.dpBox}>
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
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <Text key={d} style={styles.dpDayHdr}>{d}</Text>)}
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
                        const ds = `${dpYear}-${String(dpMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                        const sel = billForm.due_date === ds;
                        const tod = dpYear === today.getFullYear() && dpMonth === today.getMonth() + 1 && day === today.getDate();
                        return (
                          <TouchableOpacity key={col} style={[styles.dpCell, sel && styles.dpCellSel, tod && !sel && styles.dpCellToday]}
                            onPress={() => { setBillForm(f => ({ ...f, due_date: ds })); setShowDatePicker(false); }}>
                            <Text style={[styles.dpDayTxt, sel && styles.dpDayTxtSel, tod && !sel && styles.dpDayTxtToday]}>{day}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ));
                })()}
              </View>
            )}

            <Text style={styles.label}>Description <Text style={styles.optional}>optional</Text></Text>
            <TextInput style={styles.input} value={billForm.description} onChangeText={v => setBillForm({ ...billForm, description: v })}
              placeholder="e.g. April maintenance" placeholderTextColor={Colors.textMuted} />

            <TouchableOpacity style={styles.submitBtn} onPress={addBill} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Add Bill & Notify Members</Text>}
            </TouchableOpacity>
            <View style={{ height: 32 }} />
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
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 8 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  filterBar: { backgroundColor: Colors.white, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },

  tabBar: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: '800' },

  list: { padding: 16 },

  // Summary banner
  summaryBanner: {
    flexDirection: 'row', backgroundColor: Colors.primary, borderRadius: 16,
    padding: 18, marginHorizontal: 16, marginTop: 14, marginBottom: 4, alignItems: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: Colors.white },
  summaryLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontWeight: '600' },
  summaryDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' },

  // Bill sub-tab switcher
  billSubTabRow: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 16, marginTop: 14, marginBottom: 2,
  },
  billSubTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  billSubTabActive: {
    backgroundColor: Colors.danger, borderColor: Colors.danger,
  },
  billSubTabPaidActive: {
    backgroundColor: Colors.success, borderColor: Colors.success,
  },
  billSubTabText: { fontSize: 13, fontWeight: '700', color: Colors.danger },
  billSubTabTextActive: { color: Colors.white },
  billSubTabBadge: {
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1,
  },
  billSubTabBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.white },

  // Section headers (kept for other uses)
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10, marginTop: 4,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeText: { fontSize: 12, fontWeight: '800', color: Colors.white },

  // Bill card
  billCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  billCardPaid: { opacity: 0.9 },
  billAccent: { width: 4 },
  billBody: { flex: 1, padding: 14 },
  billTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  billPeriodBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },
  billMonth: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  billYear: { fontSize: 10, color: Colors.textMuted },
  billAmount: { fontSize: 18, fontWeight: '800', color: Colors.text },
  penaltyNote: { fontSize: 11, color: '#DC2626', fontWeight: '600' },
  billDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  dueDateText: { fontSize: 12, color: Colors.warning, fontWeight: '600', marginBottom: 8 },
  paidAtText: { fontSize: 12, color: Colors.success, fontWeight: '600', marginBottom: 8 },
  billActions: { flexDirection: 'row', gap: 10 },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  payBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  receiptBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  // Member row
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  memberName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  memberMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  memberBadges: { flexDirection: 'column', gap: 4, alignItems: 'flex-end', marginRight: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Overview
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 12, borderLeftWidth: 3, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  amtRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  amtCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: Colors.primary, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  amtLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  amtValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  overviewGroup: { marginBottom: 16 },
  overviewGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },

  empty: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { fontSize: 15, color: Colors.textMuted, fontWeight: '600' },
  emptyHint: { fontSize: 13, color: Colors.border },

  // Bills tab list card
  billListCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  billListLeft: {},
  billListInfo: { flex: 1 },
  billListTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 },
  billListAmount: { fontSize: 17, fontWeight: '800', color: Colors.text },
  billListStats: { flexDirection: 'row', gap: 6, marginTop: 6 },
  penaltyChip: { backgroundColor: '#FEF2F2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  penaltyChipText: { fontSize: 11, color: '#DC2626', fontWeight: '700' },
  editedChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5F3FF', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  editedChipText: { fontSize: 10, color: '#7C3AED', fontWeight: '700' },

  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  formRow: { flexDirection: 'row' },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  optional: { fontSize: 12, color: Colors.textMuted, fontWeight: '400' },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, backgroundColor: Colors.bg },
  dateBtnText: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '500' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  dpBox: { backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, padding: 12, marginTop: 8 },
  dpNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dpNavBtn: { padding: 6 },
  dpNavLabel: { fontSize: 15, fontWeight: '800', color: Colors.text },
  dpRow: { flexDirection: 'row' },
  dpDayHdr: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted, paddingVertical: 4 },
  dpCell: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, margin: 1 },
  dpCellSel: { backgroundColor: Colors.primary },
  dpCellToday: { backgroundColor: Colors.primary + '18' },
  dpDayTxt: { fontSize: 13, fontWeight: '600', color: Colors.text },
  dpDayTxtSel: { color: Colors.white, fontWeight: '800' },
  dpDayTxtToday: { color: Colors.primary, fontWeight: '800' },
});
