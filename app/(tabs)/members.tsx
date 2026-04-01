import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'user' | 'pramukh' | 'watchman';
  status: string;
  flat_no: string | null;
};

const ROLE_COLOR: Record<string, string> = {
  pramukh: Colors.primary,
  user: Colors.success,
  watchman: '#F59E0B',
};

const ROLE_LABEL: Record<string, string> = {
  pramukh: 'Pramukh',
  user: 'Member',
  watchman: 'Watchman',
};

export default function MembersScreen() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchMembers = async () => {
    try {
      const res = await api.get('/buildings/members');
      // Sort: pramukh first, then by flat_no
      const sorted = [...res.data].sort((a: Member, b: Member) => {
        if (a.role === 'pramukh' && b.role !== 'pramukh') return -1;
        if (b.role === 'pramukh' && a.role !== 'pramukh') return 1;
        return (a.flat_no || '').localeCompare(b.flat_no || '');
      });
      setMembers(sorted);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchMembers(); }, []));

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.flat_no || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.phone || '').includes(search)
  );

  const renderItem = ({ item }: { item: Member }) => {
    const color = ROLE_COLOR[item.role] || Colors.textMuted;
    const isPramukh = item.role === 'pramukh';
    return (
      <View style={[styles.card, isPramukh && styles.pramukhCard]}>
        <View style={[styles.avatar, { backgroundColor: color + '20' }]}>
          <Text style={[styles.avatarText, { color }]}>{item.name?.[0]?.toUpperCase()}</Text>
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={[styles.roleBadge, { backgroundColor: color + '18' }]}>
              <Text style={[styles.roleText, { color }]}>{ROLE_LABEL[item.role] || item.role}</Text>
            </View>
          </View>

          {item.flat_no ? (
            <View style={styles.detailRow}>
              <Ionicons name="home-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.detailText}>Flat {item.flat_no}</Text>
            </View>
          ) : null}

          {item.phone ? (
            <TouchableOpacity style={styles.detailRow} onPress={() => Linking.openURL(`tel:${item.phone}`)}>
              <Ionicons name="call-outline" size={13} color={Colors.primary} />
              <Text style={[styles.detailText, styles.phoneText]}>{item.phone}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={13} color={Colors.border} />
              <Text style={[styles.detailText, { color: Colors.border }]}>No phone</Text>
            </View>
          )}
        </View>

        {item.phone ? (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${item.phone}`)}
          >
            <Ionicons name="call" size={18} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Members</Text>
        <Text style={styles.headerSub}>{members.length} in your society</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, flat or phone..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMembers(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyText}>{search ? 'No members match your search' : 'No members yet'}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20,
  },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, margin: 16, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  list: { paddingHorizontal: 16, paddingBottom: 32 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  pramukhCard: {
    borderWidth: 1.5, borderColor: Colors.primary + '40',
    backgroundColor: '#EFF6FF',
  },

  avatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },

  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  roleText: { fontSize: 11, fontWeight: '700' },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  detailText: { fontSize: 13, color: Colors.textMuted },
  phoneText: { color: Colors.primary, fontWeight: '600' },

  callBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },

  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
});
