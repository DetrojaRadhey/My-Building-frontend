import React, { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Share, Modal, ScrollView, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { ENTRY_BASE } from '../constants/api';
import { useBuildings } from '../hooks/useBuildings';
import BuildingDropdown from '../components/BuildingDropdown';
import type { Building } from '../hooks/useBuildings';
import { useMarkNotificationsRead } from '../hooks/useMarkNotificationsRead';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toLocalDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function VisitorsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh';

  useMarkNotificationsRead(['visitor']);
  // All roles can share QR
  const canShareQR = true;
  const params = useLocalSearchParams<{ building_id?: string; building_name?: string }>();

  const { buildings, loading: buildingsLoading } = useBuildings(isAdmin);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  useEffect(() => {
    if (params.building_id && params.building_name && isAdmin) {
      setSelectedBuilding({ id: params.building_id, name: params.building_name });
    }
  }, [params.building_id]);

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1); // 1-based
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateStr(today));
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());
  const [datesLoading, setDatesLoading] = useState(false);

  // Visitor list state
  const [visitors, setVisitors] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Detail modal
  const [detailItem, setDetailItem] = useState<any | null>(null);

  const activeBuildingId = isAdmin ? selectedBuilding?.id : user?.building_id;
  const qrUrl = activeBuildingId ? `${ENTRY_BASE}/building/${activeBuildingId}` : null;

  // Fetch marked dates for current calendar month
  const fetchDates = useCallback(async () => {
    if (isAdmin && !selectedBuilding) return;
    setDatesLoading(true);
    try {
      const params: any = { month: calMonth, year: calYear };
      if (isAdmin && selectedBuilding) params.building_id = selectedBuilding.id;
      const res = await api.get('/visitors/dates', { params });
      setMarkedDates(new Set(res.data.dates));
    } catch {
      // silently fail — dots just won't show
    } finally {
      setDatesLoading(false);
    }
  }, [calMonth, calYear, selectedBuilding, isAdmin]);

  // Fetch visitors for selected date
  const fetchVisitors = useCallback(async (date: string) => {
    if (isAdmin && !selectedBuilding) return;
    setListLoading(true);
    try {
      const params: any = { date };
      if (isAdmin && selectedBuilding) params.building_id = selectedBuilding.id;
      const res = await api.get('/visitors', { params });
      setVisitors(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load visitors');
    } finally {
      setListLoading(false);
      setRefreshing(false);
    }
  }, [selectedBuilding, isAdmin]);

  useEffect(() => { fetchDates(); }, [fetchDates]);
  useEffect(() => { fetchVisitors(selectedDate); }, [selectedDate, fetchVisitors]);

  const prevMonth = () => {
    if (calMonth === 1) { setCalMonth(12); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalMonth(1); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  };

  const shareQR = async () => {
    if (!qrUrl) return Alert.alert('No Building', 'No building linked to your account');
    await Share.share({ message: `Scan to register your visit: ${qrUrl}`, url: qrUrl });
  };

  // Build calendar grid
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (calCells.length % 7 !== 0) calCells.push(null);

  const renderCalendar = () => (
    <View style={styles.calendarCard}>
      {/* Month navigation */}
      <View style={styles.calNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.calMonthLabel}>{MONTHS[calMonth - 1]} {calYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.calRow}>
        {DAYS.map((d) => (
          <Text key={d} style={styles.calDayHeader}>{d}</Text>
        ))}
      </View>

      {/* Date cells */}
      {Array.from({ length: calCells.length / 7 }, (_, row) => (
        <View key={row} style={styles.calRow}>
          {calCells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={styles.calCell} />;
            const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === toLocalDateStr(today);
            const hasVisitors = markedDates.has(dateStr);
            return (
              <TouchableOpacity
                key={col}
                style={[styles.calCell, isSelected && styles.calCellSelected, isToday && !isSelected && styles.calCellToday]}
                onPress={() => setSelectedDate(dateStr)}
              >
                <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected, isToday && !isSelected && styles.calDayTextToday]}>
                  {day}
                </Text>
                {hasVisitors && <View style={[styles.calDot, isSelected && styles.calDotSelected]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  const renderVisitorItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => setDetailItem(item)} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardMeta}>{item.phone}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={styles.cardTime}>
            {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </View>
      </View>
      <View style={styles.cardDetails}>
        {item.flat_no ? (
          <View style={styles.detailRow}>
            <Ionicons name="home-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.detailText}>Flat {item.flat_no}</Text>
          </View>
        ) : null}
        {item.purpose || item.work_detail ? (
          <View style={styles.detailRow}>
            <Ionicons name="briefcase-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.detailText}>{item.purpose || item.work_detail}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const formattedSelected = (() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  })();

  

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('visitors')}</Text>
        <TouchableOpacity style={styles.qrBtn} onPress={shareQR}>
          <Ionicons name="qr-code" size={18} color={Colors.white} />
          <Text style={styles.qrBtnText}>Share QR</Text>
        </TouchableOpacity>
      </View>

      {/* Admin building filter */}
      {isAdmin && (
        <View style={styles.filterBar}>
          <BuildingDropdown
            buildings={buildings}
            loading={buildingsLoading}
            selected={selectedBuilding}
            onSelect={(b) => { setSelectedBuilding(b); setMarkedDates(new Set()); setVisitors([]); }}
            label="Select Building"
          />
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchVisitors(selectedDate); fetchDates(); }} />}
      >
        {/* Calendar */}
        {renderCalendar()}

        {/* Selected date header */}
        <View style={styles.dateHeader}>
          <Ionicons name="calendar" size={15} color={Colors.primary} />
          <Text style={styles.dateHeaderText}>{formattedSelected}</Text>
          {datesLoading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />}
        </View>

        {/* Visitor list */}
        {listLoading ? (
          <ActivityIndicator style={{ marginTop: 32 }} size="large" color={Colors.primary} />
        ) : visitors.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={40} color={Colors.border} />
            <Text style={styles.empty}>
              {isAdmin && !selectedBuilding ? t('selectBuildingToView') : t('noVisitors')}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
            {visitors.map((item) => (
              <View key={item.id}>
                {renderVisitorItem({ item })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!detailItem} transparent animationType="slide" onRequestClose={() => setDetailItem(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailItem(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {/* Visitor photo */}
            {detailItem?.photo_url ? (
              <Image
                source={{ uri: detailItem.photo_url }}
                style={styles.modalPhoto}
                resizeMode="cover"
              />
            ) : null}

            <View style={styles.modalAvatarRow}>
              {!detailItem?.photo_url && (
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>{detailItem?.name?.[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.modalName}>{detailItem?.name}</Text>
                <Text style={styles.modalSub}>Visitor Details</Text>
              </View>
              <TouchableOpacity onPress={() => setDetailItem(null)}>
                <Ionicons name="close-circle" size={28} color={Colors.border} />
              </TouchableOpacity>
            </View>

            {[
              { icon: 'call-outline', label: 'Phone', value: detailItem?.phone },
              { icon: 'home-outline', label: 'Flat No.', value: detailItem?.flat_no },
              { icon: 'briefcase-outline', label: 'Purpose', value: detailItem?.purpose || detailItem?.work_detail },
              { icon: 'calendar-outline', label: 'Date', value: detailItem ? new Date(detailItem.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '' },
              { icon: 'time-outline', label: 'Time', value: detailItem ? new Date(detailItem.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '' },
            ].filter((r) => r.value).map((row) => (
              <View key={row.label} style={styles.modalRow}>
                <View style={styles.modalRowIcon}>
                  <Ionicons name={row.icon as any} size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalRowLabel}>{row.label}</Text>
                  <Text style={styles.modalRowValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  qrBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  qrBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },

  // Calendar
  calendarCard: { backgroundColor: Colors.white, margin: 16, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: { padding: 6 },
  calMonthLabel: { fontSize: 16, fontWeight: '800', color: Colors.text },
  calRow: { flexDirection: 'row' },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.textMuted, paddingVertical: 4 },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, margin: 1 },
  calCellSelected: { backgroundColor: Colors.primary },
  calCellToday: { backgroundColor: Colors.primary + '15' },
  calDayText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  calDayTextSelected: { color: Colors.white, fontWeight: '800' },
  calDayTextToday: { color: Colors.primary, fontWeight: '800' },
  calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent, marginTop: 2 },
  calDotSelected: { backgroundColor: Colors.white },

  // Date header
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 10 },
  dateHeaderText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Visitor cards
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textMuted },
  cardTime: { fontSize: 12, color: Colors.textMuted },
  cardDetails: { gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: Colors.textMuted },
  emptyBox: { alignItems: 'center', paddingTop: 48, gap: 10 },
  empty: { textAlign: 'center', color: Colors.textMuted, fontSize: 15 },

  // Detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  modalPhoto: { width: '100%', height: 200, borderRadius: 14, marginBottom: 16 },
  modalAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  modalAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  modalAvatarText: { fontSize: 24, fontWeight: '800', color: Colors.primary },
  modalName: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalRowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + '12', justifyContent: 'center', alignItems: 'center' },
  modalRowLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalRowValue: { fontSize: 15, fontWeight: '600', color: Colors.text, marginTop: 1 },
});
