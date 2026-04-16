import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, FlatList, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import api from '../utils/api';
import * as ImagePicker from 'expo-image-picker';

// ── Data ──────────────────────────────────────────────────────────────────────
const SOCIETY_TYPES = ['Apartment Complex', 'Gated Community', 'Township', 'Co-operative Housing', 'Villa Society', 'Other'];
const PAYMENT_METHODS = ['Cash Only', 'Cheque', 'Online (Payment Gateway)', 'Both Cash & Online', 'Cheque & Online'];

const STATES_CITIES: Record<string, string[]> = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Gandhinagar'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Hubli', 'Mangaluru', 'Belagavi'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Surat', 'Thane', 'Navi Mumbai'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
  'Delhi': ['New Delhi', 'Dwarka', 'Rohini', 'Janakpuri', 'Laxmi Nagar'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut', 'Noida', 'Ghaziabad'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Chandigarh'],
  'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat'],
  'Himachal Pradesh': ['Shimla', 'Manali', 'Dharamshala', 'Solan'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Rishikesh', 'Nainital'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba'],
  'Jammu & Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'],
};

const ALL_STATES = Object.keys(STATES_CITIES).sort();

// ── Picker Modal ──────────────────────────────────────────────────────────────
function PickerModal({ visible, title, options, onSelect, onClose }: {
  visible: boolean; title: string; options: string[];
  onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          <View style={pm.header}>
            <Text style={pm.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.text} /></TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(i) => i}
            renderItem={({ item }) => (
              <TouchableOpacity style={pm.item} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={pm.itemText}>{item}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 16, fontWeight: '800', color: Colors.text },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemText: { fontSize: 15, color: Colors.text },
});

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={tog.row}>
      <Text style={tog.label}>{label}</Text>
      <TouchableOpacity style={[tog.track, value && tog.trackOn]} onPress={() => onChange(!value)}>
        <View style={[tog.thumb, value && tog.thumbOn]} />
      </TouchableOpacity>
    </View>
  );
}
const tog = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: 15, color: Colors.text, flex: 1 },
  track: { width: 48, height: 26, borderRadius: 13, backgroundColor: Colors.border, justifyContent: 'center', padding: 2 },
  trackOn: { backgroundColor: Colors.primary },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white },
  thumbOn: { alignSelf: 'flex-end' },
});

// ── Select Field ──────────────────────────────────────────────────────────────
function SelectField({ label, value, placeholder, onPress }: { label: string; value: string; placeholder: string; onPress: () => void }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.select} onPress={onPress}>
        <Text style={[styles.selectText, !value && { color: Colors.textMuted }]}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
const STEPS = ['Basic Info', 'Location', 'Financials', 'Payment'];

export default function RegisterBuildingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState<{ key: string; title: string; options: string[] } | null>(null);

  const [form, setForm] = useState({
    // Basic
    society_type: '', society_name: '', total_wings: '',
    society_logo: '',
    // Location
    state: '', city: '', pincode: '', address: '',
    // Financials
    late_fee: '', maintenance_fixed: false, water_bill_separate: false,
    // Payment
    payment_method: '', payment_tc: '', payment_gateway_link: '',
  });

  const [logoError, setLogoError] = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
      setLogoError('Image must be under 2 MB. Please choose a smaller image.');
      set('society_logo', '');
      return;
    }
    setLogoError('');
    set('society_logo', `data:image/jpeg;base64,${asset.base64}`);
  };

  const openPicker = (key: string, title: string, options: string[]) => setPicker({ key, title, options });

  const canNext = () => {
    if (step === 0) return form.society_type && form.society_name.trim() && form.total_wings.trim();
    if (step === 1) return form.state && form.city && form.pincode.trim() && form.address.trim();
    if (step === 2) return true;
    if (step === 3) return !!form.payment_method;
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.post('/inquiries', form);
      Alert.alert(
        'Submitted!',
        'Your building registration request has been received. Our admin will review and set up your society.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register Your Building</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepBar}>
        {STEPS.map((st, i) => (
          <View key={st} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
              {i < step
                ? <Ionicons name="checkmark" size={12} color={Colors.white} />
                : <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>}
            </View>
            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{st}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Step 0: Basic Info ── */}
        {step === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Basic Information</Text>
            <SelectField label="Society Type *" value={form.society_type} placeholder="Select type" onPress={() => openPicker('society_type', 'Society Type', SOCIETY_TYPES)} />
            <Text style={styles.label}>Society Name *</Text>
            <TextInput style={styles.input} value={form.society_name} onChangeText={v => set('society_name', v)} placeholder="e.g. Yamuna Park Society" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Total Wings *</Text>
            <TextInput style={styles.input} value={form.total_wings} onChangeText={v => set('total_wings', v)} placeholder="e.g. 4" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Society Logo (optional)</Text>
            <TouchableOpacity style={styles.logoPicker} onPress={pickLogo}>
              {form.society_logo
                ? <Image source={{ uri: form.society_logo }} style={styles.logoPreview} />
                : <View style={styles.logoPlaceholder}>
                    <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
                    <Text style={styles.logoPlaceholderText}>Tap to select logo</Text>
                  </View>
              }
            </TouchableOpacity>
            {logoError ? <Text style={styles.logoError}>{logoError}</Text> : null}
          </View>
        )}

        {/* ── Step 1: Location ── */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Location Details</Text>
            <SelectField label="State *" value={form.state} placeholder="Select state" onPress={() => openPicker('state', 'Select State', ALL_STATES)} />
            <SelectField label="City *" value={form.city} placeholder={form.state ? 'Select city' : 'Select state first'} onPress={() => form.state && openPicker('city', 'Select City', STATES_CITIES[form.state] || [])} />
            <Text style={styles.label}>Pincode *</Text>
            <TextInput style={styles.input} value={form.pincode} onChangeText={v => set('pincode', v)} placeholder="e.g. 395004" keyboardType="numeric" maxLength={6} placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Full Address *</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={form.address} onChangeText={v => set('address', v)} placeholder="Street, Area, Landmark..." multiline placeholderTextColor={Colors.textMuted} />
          </View>
        )}

        {/* ── Step 2: Financials ── */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Financial Details</Text>
            <Text style={styles.label}>Late Fee for Overdue Maintenance (₹)</Text>
            <TextInput style={styles.input} value={form.late_fee} onChangeText={v => set('late_fee', v)} placeholder="e.g. 100 (leave blank if none)" keyboardType="numeric" placeholderTextColor={Colors.textMuted} />
            <View style={{ marginTop: 8 }}>
              <Toggle label="Is maintenance amount fixed?" value={form.maintenance_fixed} onChange={v => set('maintenance_fixed', v)} />
              <Toggle label="Is water bill separate?" value={form.water_bill_separate} onChange={v => set('water_bill_separate', v)} />
            </View>
          </View>
        )}

        {/* ── Step 3: Payment ── */}
        {step === 3 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment Details</Text>
            <SelectField label="Maintenance Payment Method *" value={form.payment_method} placeholder="Select method" onPress={() => openPicker('payment_method', 'Payment Method', PAYMENT_METHODS)} />
            {(form.payment_method === 'Cheque' || form.payment_method === 'Cheque & Online') && (
              <View style={styles.infoNote}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.infoNoteText}>Members will be able to upload a transaction receipt as proof of payment.</Text>
              </View>
            )}
            {form.payment_method === 'Online (Payment Gateway)' && (
              <>
                <Text style={styles.label}>Payment Gateway Link</Text>
                <TextInput
                  style={styles.input}
                  value={form.payment_gateway_link}
                  onChangeText={v => set('payment_gateway_link', v)}
                  placeholder="https://pay.example.com/..."
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </>
            )}
            <Text style={styles.label}>Payment Terms & Conditions (optional)</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              value={form.payment_tc}
              onChangeText={v => { if (v.length <= 1000) set('payment_tc', v); }}
              placeholder="e.g. Payment is due by the 10th of each month..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={1000}
            />
            <Text style={[styles.charCount, form.payment_tc.length >= 900 && styles.charCountWarn]}>
              {form.payment_tc.length}/1000
            </Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Summary</Text>
              {[
                ['Society', form.society_name],
                ['Type', form.society_type],
                ['Wings', form.total_wings],
                ['Location', `${form.city}, ${form.state}`],
                ['Pincode', form.pincode],
              ].map(([k, v]) => (
                <View key={k} style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>{k}</Text>
                  <Text style={styles.summaryVal}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Navigation */}
        <View style={styles.navRow}>
          {step > 0 && (
            <TouchableOpacity style={styles.backNavBtn} onPress={() => setStep(s => s - 1)}>
              <Ionicons name="arrow-back" size={18} color={Colors.primary} />
              <Text style={styles.backNavText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled, step === 0 && { marginLeft: 'auto' }]}
            onPress={() => step < STEPS.length - 1 ? setStep(s => s + 1) : submit()}
            disabled={!canNext() || submitting}
          >
            {submitting
              ? <ActivityIndicator color={Colors.white} />
              : <>
                  <Text style={styles.nextBtnText}>{step === STEPS.length - 1 ? 'Submit Request' : 'Next'}</Text>
                  {step < STEPS.length - 1 && <Ionicons name="arrow-forward" size={18} color={Colors.white} />}
                </>}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Picker Modal */}
      {picker && (
        <PickerModal
          visible
          title={picker.title}
          options={picker.options}
          onSelect={v => {
            set(picker.key, v);
            if (picker.key === 'state') set('city', '');
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.white },
  stepBar: { flexDirection: 'row', backgroundColor: Colors.white, paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: Colors.primary },
  stepNum: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  stepNumActive: { color: Colors.white },
  stepLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  stepLabelActive: { color: Colors.primary },
  scroll: { padding: 16 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg, marginBottom: 14 },
  select: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, backgroundColor: Colors.bg },
  selectText: { fontSize: 15, color: Colors.text },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  backNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 13 },
  backNavText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14 },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  summaryBox: { backgroundColor: Colors.bg, borderRadius: 12, padding: 14, marginTop: 16 },
  summaryTitle: { fontSize: 13, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  summaryKey: { fontSize: 13, color: Colors.textMuted },
  summaryVal: { fontSize: 13, fontWeight: '600', color: Colors.text, maxWidth: '60%', textAlign: 'right' },
  logoPicker: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 60, width: 100, height: 100, alignSelf: 'center', marginBottom: 8, overflow: 'hidden', backgroundColor: Colors.bg },
  logoPreview: { width: 100, height: 100, borderRadius: 50 },
  logoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  logoPlaceholderText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  logoError: { fontSize: 12, color: Colors.danger, textAlign: 'center', marginBottom: 8 },
  infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.primary + '12', borderRadius: 10, padding: 12, marginBottom: 14 },
  infoNoteText: { fontSize: 13, color: Colors.primary, flex: 1, lineHeight: 18 },
  charCount: { fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: -10, marginBottom: 14 },
  charCountWarn: { color: Colors.danger },
});
