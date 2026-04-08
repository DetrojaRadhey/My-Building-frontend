import React, { useState, useCallback } from 'react';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import api from '../utils/api';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

function formatAction(a: string) {
  return a?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—';
}
function formatFull(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    + '  ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function formatShort(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (d.toDateString() === today)
    return 'Today ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === yesterday)
    return 'Yesterday ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

// ── Inline Calendar ───────────────────────────────────────────────────────────
function Calendar({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const cal = makeCal(Colors);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const todayStr = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());

  return (
    <View style={cal.wrap}>
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={cal.navLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={cal.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={cal.row}>
        {DAY_LABELS.map(d => <Text key={d} style={cal.dayHdr}>{d}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={cal.row}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={cal.cell} />;
            const ds = toDateStr(year, month, day);
            const isSel = ds === selected;
            const isToday = ds === todayStr;
            const isFuture = ds > todayStr;
            return (
              <TouchableOpacity
                key={col}
                style={[cal.cell, isSel && cal.cellSel, isToday && !isSel && cal.cellToday]}
                onPress={() => !isFuture && onSelect(ds)}
                disabled={isFuture}
              >
                <Text style={[cal.dayTxt, isSel && cal.dayTxtSel, isToday && !isSel && cal.dayTxtToday, isFuture && cal.dayTxtFuture]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ActivityLogsScreen() {
  const MODULE_COLORS: Record<string, string> = {
    auth: '#6366F1', maintenance: '#10B981', complaints: '#EF4444',
    vehicles: '#0EA5E9', visitors: '#F59E0B', buildings: '#1E3A8A',
    subscriptions: '#7C3AED', expenses: '#059669', chat: '#EC4899',
    meetings: '#0891B2', funds: '#D97706', requests: '#16A34A',
    announcements: '#F59E0B', promos: '#EC4899', inquiries: '#0891B2',
    helpline: '#EF4444', app: Colors.primary,
  };
  const ROLE_COLORS: Record<string, string> = {
    user: Colors.success, pramukh: Colors.accent, admin: Colors.danger,
  };
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [showCal, setShowCal] = useState(false);
  const LIMIT = 100;

  useFocusEffect(useCallback(() => { load(0); }, [selectedDate]));

  const load = async (off: number) => {
    try {
      let url = `/activity-logs?limit=${LIMIT}&offset=${off}`;
      if (selectedDate) url += `&date=${selectedDate}`;
      const res = await api.get(url);
      const incoming = res.data.logs ?? [];
      setLogs(off === 0 ? incoming : prev => [...prev, ...incoming]);
      setTotal(res.data.total ?? 0);
      setOffset(off);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  const pickDate = (d: string) => {
    setSelectedDate(d);
    setShowCal(false);
    setLoading(true);
  };

  const clearDate = () => {
    setSelectedDate('');
    setShowCal(false);
    setLoading(true);
  };

  const filtered = search.trim()
    ? logs.filter(l =>
        l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.action?.toLowerCase().includes(search.toLowerCase()) ||
        l.module?.toLowerCase().includes(search.toLowerCase()) ||
        l.user_role?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const dateLabel = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const renderItem = ({ item }: { item: any }) => {
    const modColor = MODULE_COLORS[item.module] ?? Colors.primary;
    const roleColor = ROLE_COLORS[item.user_role] ?? Colors.textMuted;
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.82}>
        <View style={[styles.strip, { backgroundColor: modColor }]} />
        <View style={styles.cardInner}>
          <View style={styles.cardTop}>
            <Text style={styles.cardAction} numberOfLines={1}>{formatAction(item.action)}</Text>
            <Text style={styles.cardTime}>{formatShort(item.created_at)}</Text>
          </View>
          <View style={styles.cardBottom}>
            <View style={[styles.rolePill, { backgroundColor: roleColor + '20' }]}>
              <Text style={[styles.rolePillText, { color: roleColor }]}>{item.user_role?.toUpperCase()}</Text>
            </View>
            <Text style={styles.cardUser} numberOfLines={1}>{item.user_name ?? '—'}</Text>
            <View style={{ flex: 1 }} />
            <View style={[styles.modPill, { backgroundColor: modColor + '18' }]}>
              <Text style={[styles.modPillText, { color: modColor }]}>{item.module}</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={14} color={Colors.border} style={{ alignSelf: 'center', marginRight: 12 }} />
      </TouchableOpacity>
    );
  };

  const DetailModal = () => {
    if (!selected) return null;
    const modColor = MODULE_COLORS[selected.module] ?? Colors.primary;
    const roleColor = ROLE_COLORS[selected.user_role] ?? Colors.textMuted;
    const detailRows: { label: string; value: string }[] = [];
    if (selected.detail && typeof selected.detail === 'object') {
      for (const [k, v] of Object.entries(selected.detail)) {
        if (v === null || v === undefined || v === '') continue;
        detailRows.push({
          label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          value: typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v),
        });
      }
    }
    return (
      <Modal visible animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={[styles.sheetHeaderStrip, { backgroundColor: modColor }]}>
              <Text style={styles.sheetAction}>{formatAction(selected.action)}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              <View style={styles.detailCard}>
                <View style={[styles.detailAvatar, { backgroundColor: roleColor }]}>
                  <Text style={styles.detailAvatarText}>{selected.user_name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailName}>{selected.user_name ?? '—'}</Text>
                  <View style={[styles.rolePill, { backgroundColor: roleColor + '20', marginTop: 4 }]}>
                    <Text style={[styles.rolePillText, { color: roleColor }]}>{selected.user_role?.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={[styles.modPill, { backgroundColor: modColor + '18' }]}>
                  <Text style={[styles.modPillText, { color: modColor }]}>{selected.module}</Text>
                </View>
              </View>
              <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={15} color={Colors.textMuted} />
                  <View>
                    <Text style={styles.metaLabel}>Timestamp</Text>
                    <Text style={styles.metaValue}>{formatFull(selected.created_at)}</Text>
                  </View>
                </View>
                {selected.ip_address ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="globe-outline" size={15} color={Colors.textMuted} />
                    <View>
                      <Text style={styles.metaLabel}>IP Address</Text>
                      <Text style={styles.metaValue} selectable>{selected.ip_address}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
              {detailRows.length > 0 ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionLabel}>Action Details</Text>
                  {detailRows.map(({ label, value }) => (
                    <View key={label} style={styles.kvRow}>
                      <Text style={styles.kvKey}>{label}</Text>
                      <Text style={styles.kvValue} selectable numberOfLines={4}>{value}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noDetail}>
                  <Text style={styles.noDetailText}>No additional details recorded</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Activity Logs</Text>
          <Text style={styles.headerSub}>{total} records · clears after 7 days</Text>
        </View>
      </View>

      {/* Search + Date button */}
      <View style={styles.toolRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, action, module..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textMuted}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.dateBtn, (selectedDate || showCal) && styles.dateBtnActive]}
          onPress={() => setShowCal(v => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={17} color={(selectedDate || showCal) ? Colors.white : Colors.primary} />
          <Ionicons name={showCal ? 'chevron-up' : 'chevron-down'} size={13} color={(selectedDate || showCal) ? Colors.white : Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Active date badge */}
      {selectedDate ? (
        <View style={styles.activeDateRow}>
          <Ionicons name="calendar" size={13} color={Colors.primary} />
          <Text style={styles.activeDateText}>{dateLabel}</Text>
          <TouchableOpacity onPress={clearDate} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={15} color={Colors.primary} />
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Calendar dropdown */}
      {showCal ? (
        <View style={styles.calDropdown}>
          <Calendar selected={selectedDate} onSelect={pickDate} />
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(0); }} tintColor={Colors.primary} />
          }
          onEndReached={() => { if (!search && logs.length < total) load(offset + LIMIT); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="document-text-outline" size={44} color={Colors.primary + '50'} />
              </View>
              <Text style={styles.emptyTitle}>No Activity Found</Text>
              <Text style={styles.emptySub}>
                {selectedDate ? `No logs on ${dateLabel}` : search ? 'No results match your search' : 'No user actions recorded yet'}
              </Text>
            </View>
          }
        />
      )}

      <DetailModal />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 14, marginBottom: 4 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1.5, borderColor: Colors.primary },
  dateBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  activeDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 4, backgroundColor: Colors.primary + '10', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  activeDateText: { fontSize: 13, fontWeight: '700', color: Colors.primary, flex: 1 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  calDropdown: { marginHorizontal: 16, marginBottom: 8, backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 5, overflow: 'hidden' },

  card: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: Colors.white, borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  strip: { width: 4 },
  cardInner: { flex: 1, padding: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  cardAction: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  cardTime: { fontSize: 11, color: Colors.textMuted, flexShrink: 0 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardUser: { fontSize: 13, color: Colors.text, fontWeight: '600', flexShrink: 1 },
  rolePill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  rolePillText: { fontSize: 10, fontWeight: '800' },
  modPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  modPillText: { fontSize: 11, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary + '10', justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', overflow: 'hidden' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 12 },
  sheetHeaderStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, marginTop: 8 },
  sheetAction: { fontSize: 17, fontWeight: '800', color: Colors.white, flex: 1 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  detailCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg, borderRadius: 12, padding: 14, marginBottom: 14 },
  detailAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  detailAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  detailName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  metaGrid: { gap: 10, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.bg, borderRadius: 10, padding: 12 },
  metaLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metaValue: { fontSize: 14, color: Colors.text, fontWeight: '500', marginTop: 2 },
  detailSection: { marginBottom: 16 },
  detailSectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  kvRow: { backgroundColor: Colors.bg, borderRadius: 10, padding: 12, marginBottom: 8 },
  kvKey: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  kvValue: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  noDetail: { backgroundColor: Colors.bg, borderRadius: 10, padding: 16, alignItems: 'center' },
  noDetailText: { fontSize: 13, color: Colors.textMuted },
});

const calStyles = StyleSheet.create({
  wrap: { padding: 14 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { padding: 6 },
  navLabel: { fontSize: 15, fontWeight: '800', color: Colors.text },
  row: { flexDirection: 'row' },
  dayHdr: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted, paddingVertical: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, margin: 1 },
  cellSel: { backgroundColor: Colors.primary },
  cellToday: { backgroundColor: Colors.primary + '18' },
  dayTxt: { fontSize: 13, fontWeight: '600', color: Colors.text },
  dayTxtSel: { color: Colors.white, fontWeight: '800' },
  dayTxtToday: { color: Colors.primary, fontWeight: '800' },
  dayTxtFuture: { color: Colors.border },
});
