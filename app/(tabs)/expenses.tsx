import React, { useState, useCallback, useMemo } from 'react';
import { Colors } from '../../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import BuildingDropdown from '../../components/BuildingDropdown';
import { useBuildings, Building } from '../../hooks/useBuildings';

type Entry = {
  id: string; type: 'inflow' | 'outflow'; amount: number;
  description: string; category: string | null; date: string;
  is_edited: boolean; edited_at: string | null;
  added_by_user?: { name: string; role: string } | null;
  edited_by_user?: { name: string } | null;
};

const INFLOW_COLOR  = '#16A34A';
const OUTFLOW_COLOR = '#EF4444';
const CATEGORIES = ['Maintenance', 'Salary', 'Repair', 'Cleaning', 'Security', 'Utilities', 'Event', 'Other'];

export default function ExpensesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin   = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh';
  const canManage = isPramukh || isAdmin;

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  const buildingId = isAdmin ? selectedBuilding?.id : user?.building_id;

  const [summary, setSummary]   = useState<any>(null);
  const [entries, setEntries]   = useState<Entry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showSetBalance, setShowSetBalance] = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [showEdit, setShowEdit] = useState<Entry | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs]         = useState<any[]>([]);
  const [showDetail, setShowDetail] = useState<Entry | null>(null);

  // Forms
  const [balanceInput, setBalanceInput] = useState('');
  const [form, setForm] = useState({ type: 'outflow', amount: '', description: '', category: '', date: new Date().toISOString().slice(0, 10) });
  const [submitting, setSubmitting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'inflow' | 'outflow'>('all');

  const [fetchError, setFetchError] = useState(false);

  const fetchData = async () => {
    if (!buildingId) { setLoading(false); setRefreshing(false); return; }
    setFetchError(false);
    try {
      const [sumRes, entRes] = await Promise.all([
        api.get('/expenses/summary', { params: { building_id: buildingId } }),
        api.get('/expenses/entries',  { params: { building_id: buildingId } }),
      ]);
      setSummary(sumRes.data);
      setEntries(entRes.data);
      // First-time pramukh: no opening balance set
      if (isPramukh && (sumRes.data?.opening_balance === null || sumRes.data?.opening_balance === undefined)) {
        setShowSetBalance(true);
      }
    } catch (e: any) {
      // If route doesn't exist yet (404) or server error — show friendly message
      setFetchError(true);
    }
    finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { fetchData(); }, [buildingId]));

  const filtered = useMemo(() =>
    typeFilter === 'all' ? entries : entries.filter(e => e.type === typeFilter),
    [entries, typeFilter]
  );

  const totals = useMemo(() => {
    const inflow  = entries.filter(e => e.type === 'inflow').reduce((s, e) => s + Number(e.amount), 0);
    const outflow = entries.filter(e => e.type === 'outflow').reduce((s, e) => s + Number(e.amount), 0);
    return { inflow, outflow };
  }, [entries]);

  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  // ── Set opening balance ───────────────────────────────────────────────────
  const saveBalance = async () => {
    const val = parseFloat(balanceInput);
    if (isNaN(val) || val < 0) return Alert.alert('Error', 'Enter a valid amount');
    setSubmitting(true);
    try {
      const res = await api.post('/expenses/opening-balance', {
        amount: val,
        building_id: buildingId,
      });
      setSummary((prev: any) => ({ ...prev, opening_balance: val, current_balance: res.data.current_balance }));
      setShowSetBalance(false);
      setBalanceInput('');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  // ── Add entry ─────────────────────────────────────────────────────────────
  const addEntry = async () => {
    if (!form.amount || !form.description.trim()) return Alert.alert('Error', 'Amount and description are required');
    setSubmitting(true);
    try {
      const res = await api.post('/expenses/entries', { ...form, building_id: buildingId });
      setEntries(prev => [res.data.entry, ...prev]);
      setSummary((prev: any) => ({ ...prev, current_balance: res.data.current_balance }));
      setShowAdd(false);
      setForm({ type: 'outflow', amount: '', description: '', category: '', date: new Date().toISOString().slice(0, 10) });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  // ── Edit entry ────────────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!showEdit) return;
    if (!form.amount || !form.description.trim()) return Alert.alert('Error', 'Amount and description are required');
    setSubmitting(true);
    try {
      const res = await api.patch(`/expenses/entries/${showEdit.id}`, { ...form, building_id: buildingId });
      setEntries(prev => prev.map(e => e.id === showEdit.id ? res.data.entry : e));
      setSummary((prev: any) => ({ ...prev, current_balance: res.data.current_balance }));
      setShowEdit(null);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  // ── Delete entry ──────────────────────────────────────────────────────────
  const deleteEntry = (id: string) => {
    Alert.alert('Delete', 'Delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const res = await api.delete(`/expenses/entries/${id}`);
          setEntries(prev => prev.filter(e => e.id !== id));
          setSummary((prev: any) => ({ ...prev, current_balance: res.data.current_balance }));
        } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
      }},
    ]);
  };

  // ── Load logs ─────────────────────────────────────────────────────────────
  const openLogs = async () => {
    try {
      const res = await api.get('/expenses/logs', { params: { building_id: buildingId } });
      setLogs(res.data);
      setShowLogs(true);
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
  };

  const openEdit = (item: Entry) => {
    setForm({ type: item.type, amount: String(item.amount), description: item.description, category: item.category || '', date: item.date });
    setShowEdit(item);
  };

  const renderEntry = ({ item }: { item: Entry }) => {
    const isIn = item.type === 'inflow';
    const color = isIn ? INFLOW_COLOR : OUTFLOW_COLOR;
    return (
      <TouchableOpacity
        style={styles.entryCard}
        onPress={() => setShowDetail(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.entryIcon, { backgroundColor: color + '18' }]}>
          <Ionicons name={isIn ? 'arrow-down-circle' : 'arrow-up-circle'} size={26} color={color} />
        </View>
        <View style={styles.entryInfo}>
          <View style={styles.entryTopRow}>
            <Text style={styles.entryDesc} numberOfLines={1}>{item.description}</Text>
            <Text style={[styles.entryAmount, { color }]}>{isIn ? '+' : '-'}{fmt(item.amount)}</Text>
          </View>
          <View style={styles.entryMeta}>
            {item.category ? <View style={styles.catTag}><Text style={styles.catTagText}>{item.category}</Text></View> : null}
            <Text style={styles.entryDate}>{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            {item.is_edited && !isAdmin ? (
              <View style={styles.editedTag}>
                <Ionicons name="pencil" size={10} color="#7C3AED" />
                <Text style={styles.editedTagText}>Edited</Text>
              </View>
            ) : null}
          </View>
          {item.added_by_user && (
            <Text style={styles.entryBy}>By {item.added_by_user.name}</Text>
          )}
        </View>
        {canManage && (
          <View style={styles.entryActions}>
            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); openEdit(item); }} style={styles.actionBtn}>
              <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); deleteEntry(item.id); }} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Expenses</Text>
          <Text style={styles.headerSub}>Society Fund Tracker</Text>
        </View>
        <View style={styles.headerActions}>
          {canManage && (
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowAdd(true)}>
              <Ionicons name="add" size={22} color={Colors.white} />
            </TouchableOpacity>
          )}
          {isAdmin && (
            <TouchableOpacity style={styles.headerBtn} onPress={openLogs}>
              <Ionicons name="time-outline" size={20} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Admin building selector */}
      {isAdmin && (
        <View style={styles.buildingBar}>
          <BuildingDropdown buildings={buildings} loading={buildingsLoading}
            selected={selectedBuilding} onSelect={setSelectedBuilding} label="Select Building" />
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : fetchError ? (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyText}>Could not load expenses</Text>
          <Text style={styles.emptyHint}>Make sure the backend is running and the SQL schema is applied</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchData(); }}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !buildingId ? (
        <View style={styles.empty}>
          <Ionicons name="business-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyText}>Select a building to view expenses</Text>
        </View>
      ) : (
        <>
          {/* Balance card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceMain}>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              <Text style={styles.balanceAmount}>{fmt(summary?.current_balance || 0)}</Text>
              {summary?.opening_balance !== null && summary?.opening_balance !== undefined && (
                <Text style={styles.openingLabel}>Opening: {fmt(summary.opening_balance)}</Text>
              )}
            </View>
            <View style={styles.balanceSplit}>
              <View style={styles.balanceSplitItem}>
                <Ionicons name="arrow-down-circle" size={18} color={INFLOW_COLOR} />
                <View>
                  <Text style={styles.splitLabel}>Total Inflow</Text>
                  <Text style={[styles.splitAmount, { color: INFLOW_COLOR }]}>{fmt(totals.inflow)}</Text>
                </View>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceSplitItem}>
                <Ionicons name="arrow-up-circle" size={18} color={OUTFLOW_COLOR} />
                <View>
                  <Text style={styles.splitLabel}>Total Outflow</Text>
                  <Text style={[styles.splitAmount, { color: OUTFLOW_COLOR }]}>{fmt(totals.outflow)}</Text>
                </View>
              </View>
            </View>
            {canManage && (
              <TouchableOpacity style={styles.setBalanceBtn} onPress={() => { setBalanceInput(String(summary?.opening_balance || '')); setShowSetBalance(true); }}>
                <Ionicons name="settings-outline" size={14} color={Colors.primary} />
                <Text style={styles.setBalanceBtnText}>
                  {summary?.opening_balance !== null ? 'Update Opening Balance' : 'Set Opening Balance'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filter chips */}
          <View style={styles.chipRow}>
            {(['all', 'inflow', 'outflow'] as const).map(t => (
              <TouchableOpacity key={t}
                style={[styles.chip, typeFilter === t && styles.chipActive]}
                onPress={() => setTypeFilter(t)}
              >
                <Text style={[styles.chipText, typeFilter === t && styles.chipTextActive]}>
                  {t === 'all' ? 'All' : t === 'inflow' ? '↓ Inflow' : '↑ Outflow'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            renderItem={renderEntry}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={48} color={Colors.border} />
                <Text style={styles.emptyText}>No entries yet</Text>
                {canManage && <Text style={styles.emptyHint}>Tap + to add your first entry</Text>}
              </View>
            }
          />
        </>
      )}

      {/* ── Entry Detail Modal ── */}
      <Modal visible={!!showDetail} animationType="slide" presentationStyle="pageSheet">
        {showDetail && (() => {
          const isIn = showDetail.type === 'inflow';
          const color = isIn ? INFLOW_COLOR : OUTFLOW_COLOR;
          return (
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <View style={[styles.detailTypeBadge, { backgroundColor: color + '18' }]}>
                  <Ionicons name={isIn ? 'arrow-down-circle' : 'arrow-up-circle'} size={16} color={color} />
                  <Text style={[styles.detailTypeText, { color }]}>{isIn ? 'Inflow' : 'Outflow'}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowDetail(null)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Amount */}
              <View style={styles.detailAmountBox}>
                <Text style={[styles.detailAmount, { color }]}>
                  {isIn ? '+' : '-'}{fmt(showDetail.amount)}
                </Text>
              </View>

              {/* Details */}
              <View style={styles.detailRows}>
                <View style={styles.detailRow}>
                  <Ionicons name="document-text-outline" size={16} color={Colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailRowLabel}>Description</Text>
                    <Text style={styles.detailRowValue}>{showDetail.description}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailRowLabel}>Date</Text>
                    <Text style={styles.detailRowValue}>
                      {new Date(showDetail.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                </View>

                {showDetail.category && (
                  <View style={styles.detailRow}>
                    <Ionicons name="pricetag-outline" size={16} color={Colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailRowLabel}>Category</Text>
                      <Text style={styles.detailRowValue}>{showDetail.category}</Text>
                    </View>
                  </View>
                )}

                {showDetail.added_by_user && (
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailRowLabel}>Added By</Text>
                      <Text style={styles.detailRowValue}>{showDetail.added_by_user.name}</Text>
                    </View>
                  </View>
                )}

                {showDetail.is_edited && showDetail.edited_by_user && (
                  <View style={[styles.detailRow, { backgroundColor: '#F5F3FF', borderRadius: 10, padding: 10 }]}>
                    <Ionicons name="pencil" size={16} color="#7C3AED" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailRowLabel, { color: '#7C3AED' }]}>Edited By</Text>
                      <Text style={[styles.detailRowValue, { color: '#7C3AED' }]}>
                        {showDetail.edited_by_user.name}
                        {showDetail.edited_at
                          ? ` · ${new Date(showDetail.edited_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : ''}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Actions for pramukh/admin */}
              {canManage && (
                <View style={styles.detailActions}>
                  <TouchableOpacity style={styles.detailEditBtn} onPress={() => { setShowDetail(null); openEdit(showDetail); }}>
                    <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
                    <Text style={styles.detailEditBtnText}>Edit Entry</Text>
                  </TouchableOpacity>
                  {isAdmin && (
                    <TouchableOpacity style={styles.detailDeleteBtn} onPress={() => { setShowDetail(null); deleteEntry(showDetail.id); }}>
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      <Text style={styles.detailDeleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })()}
      </Modal>

      {/* ── Set Opening Balance Modal ── */}
      <Modal visible={showSetBalance} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {summary?.opening_balance !== null ? 'Update Opening Balance' : 'Set Current Balance'}
            </Text>
            <TouchableOpacity onPress={() => setShowSetBalance(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalHint}>
            Enter the current amount your society holds right now. This will be your starting point.
          </Text>
          <Text style={styles.label}>Current Balance (₹) *</Text>
          <TextInput style={styles.input} value={balanceInput} onChangeText={setBalanceInput}
            placeholder="e.g. 50000" keyboardType="numeric" placeholderTextColor={Colors.textMuted} autoFocus />
          <TouchableOpacity style={styles.submitBtn} onPress={saveBalance} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Balance</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Add / Edit Entry Modal ── */}
      <Modal visible={showAdd || !!showEdit} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{showEdit ? 'Edit Entry' : 'New Entry'}</Text>
            <TouchableOpacity onPress={() => { setShowAdd(false); setShowEdit(null); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Type toggle */}
            <Text style={styles.label}>Type *</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, form.type === 'inflow' && { backgroundColor: INFLOW_COLOR, borderColor: INFLOW_COLOR }]}
                onPress={() => setForm({ ...form, type: 'inflow' })}
              >
                <Ionicons name="arrow-down-circle" size={18} color={form.type === 'inflow' ? Colors.white : INFLOW_COLOR} />
                <Text style={[styles.typeBtnText, form.type === 'inflow' && { color: Colors.white }]}>Inflow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, form.type === 'outflow' && { backgroundColor: OUTFLOW_COLOR, borderColor: OUTFLOW_COLOR }]}
                onPress={() => setForm({ ...form, type: 'outflow' })}
              >
                <Ionicons name="arrow-up-circle" size={18} color={form.type === 'outflow' ? Colors.white : OUTFLOW_COLOR} />
                <Text style={[styles.typeBtnText, form.type === 'outflow' && { color: Colors.white }]}>Outflow</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput style={styles.input} value={form.amount} onChangeText={v => setForm({ ...form, amount: v })}
              placeholder="e.g. 10000" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Description *</Text>
            <TextInput style={styles.input} value={form.description} onChangeText={v => setForm({ ...form, description: v })}
              placeholder="e.g. Watchman salary for April" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c}
                    style={[styles.catChip, form.category === c && styles.catChipActive]}
                    onPress={() => setForm({ ...form, category: form.category === c ? '' : c })}
                  >
                    <Text style={[styles.catChipText, form.category === c && { color: Colors.white }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>Date</Text>
            <TextInput style={styles.input} value={form.date} onChangeText={v => setForm({ ...form, date: v })}
              placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} />

            <TouchableOpacity style={styles.submitBtn} onPress={showEdit ? saveEdit : addEntry} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.submitBtnText}>{showEdit ? 'Save Changes' : 'Add Entry'}</Text>
              )}
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── Edit Logs Modal ── */}
      <Modal visible={showLogs} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit History</Text>
            <TouchableOpacity onPress={() => setShowLogs(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={logs}
            keyExtractor={i => i.id}
            contentContainerStyle={{ paddingBottom: 32 }}
            ListEmptyComponent={<Text style={[styles.emptyText, { marginTop: 40 }]}>No edits recorded</Text>}
            renderItem={({ item }) => (
              <View style={styles.logCard}>
                <View style={styles.logTop}>
                  <Ionicons name="pencil" size={14} color="#7C3AED" />
                  <Text style={styles.logBy}>{item.edited_by_user?.name || 'Unknown'}</Text>
                  <Text style={styles.logDate}>{new Date(item.edited_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <Text style={styles.logDetail}>
                  {item.old_type} · ₹{item.old_amount} · {item.old_description}
                </Text>
                {item.old_category ? <Text style={styles.logMeta}>Category: {item.old_category}</Text> : null}
              </View>
            )}
          />
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
  buildingBar: { backgroundColor: Colors.white, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },

  balanceCard: { margin: 16, backgroundColor: Colors.primary, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  balanceMain: { alignItems: 'center', marginBottom: 16 },
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  balanceAmount: { color: Colors.white, fontSize: 36, fontWeight: '800', marginTop: 4 },
  openingLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  balanceSplit: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12 },
  balanceSplitItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },
  splitLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  splitAmount: { fontSize: 15, fontWeight: '800' },
  setBalanceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, backgroundColor: Colors.white, borderRadius: 10, paddingVertical: 10 },
  setBalanceBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: Colors.white },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  chipTextActive: { color: Colors.white },

  list: { paddingHorizontal: 16, paddingBottom: 32 },
  entryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  entryIcon: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  entryInfo: { flex: 1 },
  entryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  entryDesc: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  entryAmount: { fontSize: 15, fontWeight: '800' },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  catTag: { backgroundColor: Colors.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  catTagText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  entryDate: { fontSize: 11, color: Colors.textMuted },
  editedTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5F3FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  editedTagText: { fontSize: 10, color: '#7C3AED', fontWeight: '700' },
  entryBy: { fontSize: 11, color: Colors.border, marginTop: 3 },
  entryActions: { gap: 6 },
  actionBtn: { padding: 6 },

  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { fontSize: 15, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  emptyHint: { fontSize: 13, color: Colors.border, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalHint: { fontSize: 14, color: Colors.textMuted, lineHeight: 20, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 13 },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  catChip: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  logCard: { backgroundColor: Colors.bg, borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
  logTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  logBy: { fontSize: 13, fontWeight: '700', color: Colors.text, flex: 1 },
  logDate: { fontSize: 11, color: Colors.textMuted },
  logDetail: { fontSize: 13, color: Colors.text },
  logMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  // Detail modal
  detailTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  detailTypeText: { fontSize: 14, fontWeight: '700' },
  detailAmountBox: { alignItems: 'center', paddingVertical: 24 },
  detailAmount: { fontSize: 40, fontWeight: '800' },
  detailRows: { gap: 4, marginBottom: 24 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailRowLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  detailRowValue: { fontSize: 15, fontWeight: '600', color: Colors.text, marginTop: 2 },
  detailActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  detailEditBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12, paddingVertical: 13 },
  detailEditBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  detailDeleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.danger, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20 },
  detailDeleteBtnText: { fontSize: 14, fontWeight: '700', color: Colors.danger },
});
