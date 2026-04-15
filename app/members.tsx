import React, { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl,
  Linking, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import api from '../utils/api';

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'user' | 'pramukh' | 'watchman';
  status: string;
  flat_no: string | null;
  wing: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  pramukh: 'Pramukh',
  user: 'Member',
  watchman: 'Watchman',
};

export default function MembersScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const ROLE_COLOR: Record<string, string> = {
    pramukh: Colors.primary,
    user: Colors.success,
    watchman: '#F59E0B',
  };
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedWing, setSelectedWing] = useState<string>('All');

  const fetchMembers = async () => {
    try {
      const res = await api.get('/buildings/members');
      const sorted = [...res.data].sort((a: Member, b: Member) => {
        if (a.role === 'pramukh' && b.role !== 'pramukh') return -1;
        if (b.role === 'pramukh' && a.role !== 'pramukh') return 1;
        const wingCmp = (a.wing || '').localeCompare(b.wing || '');
        if (wingCmp !== 0) return wingCmp;
        return (a.flat_no || '').localeCompare(b.flat_no || '', undefined, { numeric: true });
      });
      setMembers(sorted);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchMembers(); }, []));

  // Derive unique wings from members
  const wings = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => { if (m.wing) set.add(m.wing); });
    return ['All', ...Array.from(set).sort()];
  }, [members]);

  const filtered = useMemo(() => members.filter(m => {
    const matchWing = selectedWing === 'All' || m.wing === selectedWing;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      m.name.toLowerCase().includes(q) ||
      (m.flat_no || '').toLowerCase().includes(q) ||
      (m.wing || '').toLowerCase().includes(q) ||
      (m.phone || '').includes(q);
    return matchWing && matchSearch;
  }), [members, selectedWing, search]);

  // Count per wing for badges
  const wingCounts = useMemo(() => {
    const counts: Record<string, number> = { All: members.length };
    members.forEach(m => {
      if (m.wing) counts[m.wing] = (counts[m.wing] || 0) + 1;
    });
    return counts;
  }, [members]);

  const renderItem = ({ item }: { item: Member }) => {
    const color = ROLE_COLOR[item.role] || Colors.textMuted;
    const isPramukh = item.role === 'pramukh';
    return (
      <View style={[styles.card, isPramukh && styles.pramukhCard]}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: color + '22' }]}>
          <Text style={[styles.avatarText, { color }]}>{item.name?.[0]?.toUpperCase()}</Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.roleBadge, { backgroundColor: color + '18' }]}>
              <Text style={[styles.roleText, { color }]}>{ROLE_LABEL[item.role] || item.role}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            {item.wing ? (
              <View style={styles.metaChip}>
                <Ionicons name="layers-outline" size={11} color={Colors.textMuted} />
                <Text style={styles.metaChipText}>Wing {item.wing}</Text>
              </View>
            ) : null}
            {item.flat_no ? (
              <View style={styles.metaChip}>
                <Ionicons name="home-outline" size={11} color={Colors.textMuted} />
                <Text style={styles.metaChipText}>Flat {item.flat_no}</Text>
              </View>
            ) : null}
          </View>

          {item.phone ? (
            <TouchableOpacity
              style={styles.phoneRow}
              onPress={() => Linking.openURL(`tel:${item.phone}`)}
            >
              <Ionicons name="call-outline" size={12} color={Colors.primary} />
              <Text style={styles.phoneText}>{item.phone}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.noPhone}>No phone added</Text>
          )}
        </View>

        {/* Call button */}
        {item.phone ? (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${item.phone}`)}
          >
            <Ionicons name="call" size={17} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
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
          <Text style={styles.headerTitle}>{t('members')}</Text>
          <Text style={styles.headerSub}>
            {filtered.length} of {members.length} members
            {selectedWing !== 'All' ? ` · Wing ${selectedWing}` : ''}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, flat, phone..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Wing filter chips */}
      {wings.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.wingScroll}
          contentContainerStyle={styles.wingRow}
        >
          {wings.map(w => {
            const active = selectedWing === w;
            return (
              <TouchableOpacity
                key={w}
                style={[styles.wingChip, active && styles.wingChipActive]}
                onPress={() => setSelectedWing(w)}
              >
                <Text style={[styles.wingChipText, active && styles.wingChipTextActive]}>
                  {w === 'All' ? 'All Wings' : `Wing ${w}`}
                </Text>
                <View style={[styles.wingCount, active && styles.wingCountActive]}>
                  <Text style={[styles.wingCountText, active && styles.wingCountTextActive]}>
                    {wingCounts[w] || 0}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchMembers(); }}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyTitle}>
                {search || selectedWing !== 'All' ? t('noMembers') : t('noMembersYet')}
              </Text>
              {(search || selectedWing !== 'All') && (
                <TouchableOpacity onPress={() => { setSearch(''); setSelectedWing('All'); }}>
                  <Text style={styles.clearFilter}>Clear filters</Text>
                </TouchableOpacity>
              )}
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
    backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white,
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  wingScroll: { flexGrow: 0 },
  wingRow: {
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  wingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.white,
  },
  wingChipActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  wingChipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  wingChipTextActive: { color: Colors.white },
  wingCount: {
    backgroundColor: '#E8EEF9', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2, minWidth: 22, alignItems: 'center',
  },
  wingCountActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  wingCountText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  wingCountTextActive: { color: Colors.white },

  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  pramukhCard: {
    borderWidth: 1.5, borderColor: Colors.primary + '50',
    backgroundColor: '#EFF6FF',
  },

  avatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },

  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  roleText: { fontSize: 10, fontWeight: '800' },

  metaRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.bg, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  metaChipText: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  phoneText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  noPhone: { fontSize: 12, color: Colors.border, marginTop: 2 },

  callBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },

  empty: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyTitle: { fontSize: 15, color: Colors.textMuted, fontWeight: '600' },
  clearFilter: { fontSize: 14, color: Colors.primary, fontWeight: '700', marginTop: 4 },
});
