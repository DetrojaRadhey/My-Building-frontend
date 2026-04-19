import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, Modal, FlatList,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { cacheManager, CACHE_PRESETS } from '../utils/CacheManager';

const LANGUAGES = [
  { key: 'english', label: 'English', flag: '🇬🇧' },
  { key: 'hindi',   label: 'हिन्दी',  flag: '🇮🇳' },
  { key: 'gujarati',label: 'ગુજરાતી', flag: '🇮🇳' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() { return formatDate(new Date()); }

export default function NewspaperScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [language, setLanguage] = useState('english');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [editionUrl, setEditionUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [noAddon, setNoAddon] = useState(false);
  const [notAvailable, setNotAvailable] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Admin upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [uploadDate, setUploadDate] = useState(todayStr());
  const [uploadLang, setUploadLang] = useState('english');
  const [uploading, setUploading] = useState(false);
  const [recentEditions, setRecentEditions] = useState<any[]>([]);

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (asset) {
      setUploadFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf' });
    }
  };

  const fetchAvailableDates = useCallback(async () => {
    const cacheKey = cacheManager.generateKey('newspaper', '/newspapers/available-dates', { language }, user?.role);
    const cached = await cacheManager.get<any[]>(cacheKey, CACHE_PRESETS.buildingWide);
    if (cached) setAvailableDates(cached.map((e: any) => e.date ?? e));
    try {
      const res = await api.get('/newspapers/available-dates', { params: { language } });
      const dates = res.data.map((e: any) => e.date ?? e);
      await cacheManager.set(cacheKey, res.data, CACHE_PRESETS.buildingWide);
      setAvailableDates(dates);
    } catch {}
  }, [language, user?.role]);

  const fetchEdition = useCallback(async () => {
    setLoading(true);
    setEditionUrl(null);
    setNotAvailable(false);
    setNoAddon(false);
    try {
      const res = await api.get('/newspapers', { params: { date: selectedDate, language } });
      setEditionUrl(res.data.url);
    } catch (e: any) {
      const errCode = e.response?.data?.error;
      if (errCode === 'newspaper_addon_required') {
        setNoAddon(true);
      } else {
        // not_available (404) or any other error — show friendly message, no console noise
        setNotAvailable(true);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDate, language]);

  const fetchRecentEditions = useCallback(async () => {
    if (!isAdmin) return;
    const cacheKey = cacheManager.generateKey('newspaper', '/newspapers/recent', {}, user?.role);
    const cached = await cacheManager.get<any[]>(cacheKey, CACHE_PRESETS.buildingWide);
    if (cached) setRecentEditions(cached);
    try {
      const res = await api.get('/newspapers/recent');
      await cacheManager.set(cacheKey, res.data, CACHE_PRESETS.buildingWide);
      setRecentEditions(res.data);
    } catch {}
  }, [isAdmin, user?.role]);

  useFocusEffect(useCallback(() => {
    fetchAvailableDates();
    if (!isAdmin) fetchEdition();
    else fetchRecentEditions();
  }, [language, selectedDate]));

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const submitUpload = async () => {
    if (!uploadFile) return Alert.alert('Error', 'Please select a PDF file');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('date', uploadDate);
      formData.append('language', uploadLang);
      formData.append('file', { uri: uploadFile.uri, name: uploadFile.name, type: uploadFile.mimeType } as any);
      await api.post('/newspapers', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Saved', 'Newspaper edition saved successfully');
      setUploadFile(null);
      setShowUpload(false);
      fetchRecentEditions();
      fetchAvailableDates();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save');
    } finally {
      setUploading(false);
    }
  };

  const deleteEdition = (id: string, date: string) => {
    Alert.alert('Delete Edition', `Delete ${date} edition?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/newspapers/${id}`);
          fetchRecentEditions();
          fetchAvailableDates();
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.error || 'Failed');
        }
      }},
    ]);
  };

  // Calendar rendering
  const renderCalendar = () => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayStr();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <View style={cal.container}>
        <View style={cal.header}>
          <TouchableOpacity onPress={() => setCalendarMonth(p => {
            const d = new Date(p.year, p.month - 1); return { year: d.getFullYear(), month: d.getMonth() };
          })}>
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={cal.monthLabel}>{FULL_MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={() => setCalendarMonth(p => {
            const d = new Date(p.year, p.month + 1); return { year: d.getFullYear(), month: d.getMonth() };
          })}>
            <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={cal.weekRow}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <Text key={d} style={cal.weekDay}>{d}</Text>
          ))}
        </View>
        <View style={cal.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={i} style={cal.cell} />;
            const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isFuture = dateStr > today;
            const isAvail = availableDates.includes(dateStr);
            const isSelected = dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={i}
                style={[cal.cell, isSelected && cal.cellSelected, isAvail && !isSelected && cal.cellAvail]}
                onPress={() => !isFuture && handleDateSelect(dateStr)}
                disabled={isFuture}
              >
                <Text style={[cal.cellText, isFuture && { color: Colors.border }, isSelected && { color: Colors.white, fontWeight: '800' }, isAvail && !isSelected && { color: Colors.primary, fontWeight: '700' }]}>
                  {day}
                </Text>
                {isAvail && !isSelected && <View style={cal.dot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const pdfViewerUrl = editionUrl
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(editionUrl)}`
    : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📰 Newspaper</Text>
        {isAdmin ? (
          <TouchableOpacity testID="upload-btn" style={styles.uploadBtn} onPress={() => setShowUpload(true)}>
            <Ionicons name="cloud-upload-outline" size={20} color={Colors.white} />
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
      </View>

      {/* Language tabs */}
      <View style={styles.langTabs}>
        {LANGUAGES.map(l => (
          <TouchableOpacity
            key={l.key}
            style={[styles.langTab, language === l.key && styles.langTabActive]}
            onPress={() => setLanguage(l.key)}
          >
            <Text style={styles.langFlag}>{l.flag}</Text>
            <Text style={[styles.langLabel, language === l.key && styles.langLabelActive]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date picker row */}
      <TouchableOpacity style={styles.datePicker} onPress={() => setShowCalendar(true)}>
        <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
        <Text style={styles.datePickerText}>
          {(() => {
            const d = new Date(selectedDate + 'T00:00:00');
            return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
          })()}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
        {availableDates.includes(selectedDate) && (
          <View style={styles.availBadge}><Text style={styles.availBadgeText}>Available</Text></View>
        )}
      </TouchableOpacity>

      {/* Content area */}
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : isAdmin ? (
        // Admin: show recent editions list
        <FlatList
          data={recentEditions}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyTitle}>No editions uploaded yet</Text>
              <Text style={styles.emptyText}>Tap the upload button to add today's newspaper</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.editionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.editionDate}>{item.date}</Text>
                <Text style={styles.editionLang}>{item.language} · {item.source}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteEdition(item.id, item.date)} style={styles.deleteBtn} testID="delete-edition-btn">
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        />
      ) : noAddon ? (
        <View style={styles.empty}>
          <Ionicons name="newspaper-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>Newspaper Add-On Required</Text>
          <Text style={styles.emptyText}>Enable the ₹3/month newspaper add-on in your subscription to read daily newspapers.</Text>
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/subscribe' as any)}>
            <Text style={styles.upgradeBtnText}>Enable Add-On</Text>
          </TouchableOpacity>
        </View>
      ) : notAvailable ? (
        <View style={styles.empty}>
          <Ionicons name="newspaper-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>No Newspaper Today</Text>
          <Text style={styles.emptyText}>
            The newspaper for this date hasn't been uploaded yet. Check back later or try a different date.
          </Text>
        </View>
      ) : pdfViewerUrl ? (
        <WebView
          source={{ uri: pdfViewerUrl }}
          style={{ flex: 1 }}
          startInLoadingState
          renderLoading={() => <ActivityIndicator style={{ marginTop: 60 }} size="large" color={Colors.primary} />}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      ) : null}

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCalendar(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.calendarSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Date</Text>
            {renderCalendar()}
            <TouchableOpacity style={styles.todayBtn} onPress={() => handleDateSelect(todayStr())}>
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Admin Upload Modal */}
      <Modal visible={showUpload} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowUpload(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.uploadSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Upload Newspaper</Text>

            <Text style={styles.inputLabel}>Date</Text>
            <TouchableOpacity style={styles.inputBox} onPress={() => {
              setShowUpload(false);
              setTimeout(() => setShowCalendar(true), 300);
            }}>
              <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
              <Text style={styles.inputText}>{uploadDate}</Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Language</Text>
            <View style={styles.langRow}>
              {LANGUAGES.map(l => (
                <TouchableOpacity
                  key={l.key}
                  style={[styles.langChip, uploadLang === l.key && styles.langChipActive]}
                  onPress={() => setUploadLang(l.key)}
                >
                  <Text style={[styles.langChipText, uploadLang === l.key && { color: Colors.white }]}>{l.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>PDF File</Text>
            <TouchableOpacity testID="pick-pdf-btn" style={styles.pdfPickerBtn} onPress={pickPdf}>
              <Ionicons name="document-attach-outline" size={18} color={Colors.primary} />
              <Text style={styles.pdfPickerText} numberOfLines={1}>
                {uploadFile ? uploadFile.name : 'Pick PDF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveBtn, uploading && { opacity: 0.5 }]} onPress={submitUpload} disabled={uploading}>
              {uploading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Save Edition</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  uploadBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  langTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  langTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  langTabActive: { borderBottomColor: Colors.primary },
  langFlag: { fontSize: 16 },
  langLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  langLabelActive: { color: Colors.primary, fontWeight: '800' },

  datePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  datePickerText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  availBadge: { backgroundColor: Colors.success + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  availBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.success },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  upgradeBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  upgradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  editionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  editionDate: { fontSize: 15, fontWeight: '700', color: Colors.text },
  editionLang: { fontSize: 12, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  deleteBtn: { padding: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  calendarSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  uploadSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  todayBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  todayBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12 },
  inputText: { fontSize: 14, color: Colors.text },
  langRow: { flexDirection: 'row', gap: 8 },
  langChip: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  langChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langChipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  pdfPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, padding: 12, marginTop: 2 },
  pdfPickerText: { flex: 1, fontSize: 14, color: Colors.primary, fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const cal = StyleSheet.create({
  container: { marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: Colors.text },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: Colors.primary, borderRadius: 20 },
  cellAvail: { backgroundColor: Colors.primary + '15', borderRadius: 20 },
  cellText: { fontSize: 14, color: Colors.text },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary, position: 'absolute', bottom: 4 },
});
