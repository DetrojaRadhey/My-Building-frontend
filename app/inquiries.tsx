import React, { useEffect, useState } from 'react';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, ScrollView, Alert, ActivityIndicator, RefreshControl, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../utils/api';

export default function InquiriesScreen() {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const fetchData = async () => {
    try {
      const res = await api.get('/inquiries');
      setInquiries(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
      <Text style={styles.cardName}>{item.society_name}</Text>
      <Text style={styles.cardMeta}>{item.society_type} · {item.city}, {item.state}</Text>
      <View style={styles.cardRow}>
        <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
        <Text style={styles.cardSub}>{item.user_name} · {item.user_email}</Text>
      </View>
      <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
    </TouchableOpacity>
  );

  const fields = selected ? [
    ['Submitted By', `${selected.user_name} (${selected.user_email})`],
    ['Society Type', selected.society_type],
    ['Society Name', selected.society_name],
    ['Total Wings', selected.total_wings],
    ['State', selected.state],
    ['City', selected.city],
    ['Pincode', selected.pincode],
    ['Address', selected.address],
    ['Late Fee', selected.late_fee ? `₹${selected.late_fee}` : 'None'],
    ['Fixed Maintenance', selected.maintenance_fixed ? 'Yes' : 'No'],
    ['Water Bill Separate', selected.water_bill_separate ? 'Yes' : 'No'],
    ['Payment Method', selected.payment_method],
    ['Payment T&C', selected.payment_tc],
    ['Submitted On', new Date(selected.created_at).toLocaleString('en-IN')],
  ].filter(([, v]) => v != null && v !== '') : [];

  const hasGatewayLink = selected?.payment_method === 'Online (Payment Gateway)' && selected?.payment_gateway_link;

  

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Building Inquiries</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={inquiries}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          ListEmptyComponent={<Text style={styles.empty}>No inquiries yet</Text>}
        />
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected.society_name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {/* Society logo */}
              {selected.society_logo ? (
                <View style={styles.logoBox}>
                  <Image source={{ uri: selected.society_logo }} style={styles.logoImg} resizeMode="contain" />
                </View>
              ) : null}

              {fields.map(([k, v]) => (
                <View key={k as string} style={styles.detailRow}>
                  <Text style={styles.detailKey}>{k as string}</Text>
                  <Text style={styles.detailVal}>{String(v)}</Text>
                </View>
              ))}

              {/* Payment gateway link */}
              {hasGatewayLink ? (
                <TouchableOpacity
                  style={styles.gatewayBtn}
                  onPress={() => Linking.openURL(selected.payment_gateway_link)}
                >
                  <Ionicons name="card-outline" size={16} color={Colors.white} />
                  <Text style={styles.gatewayBtnText}>Open Payment Gateway</Text>
                  <Ionicons name="open-outline" size={14} color={Colors.white} />
                </TouchableOpacity>
              ) : null}

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  cardMeta: { fontSize: 13, color: Colors.textMuted, marginBottom: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardSub: { fontSize: 12, color: Colors.textMuted },
  cardDate: { fontSize: 11, color: Colors.border, marginTop: 4 },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 60, fontSize: 15 },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, flex: 1 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailKey: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  detailVal: { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1.5, textAlign: 'right' },
  logoBox: { alignItems: 'center', marginBottom: 20, padding: 16, backgroundColor: Colors.bg, borderRadius: 14 },
  logoImg: { width: 100, height: 100, borderRadius: 12 },
  gatewayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, padding: 14, marginTop: 16 },
  gatewayBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
