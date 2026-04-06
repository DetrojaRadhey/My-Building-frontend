import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import api from '../../utils/api';
import BuildingDropdown from '../../components/BuildingDropdown';
import { useBuildings } from '../../hooks/useBuildings';
import type { Building } from '../../hooks/useBuildings';

const ROLES = ['user', 'pramukh'];
const ROLE_COLORS: Record<string, string> = {
  user: Colors.success, pramukh: Colors.primary, admin: Colors.danger,
};

export default function UsersScreen() {
  const { buildings, loading: buildingsLoading } = useBuildings(true);
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterBuilding, setFilterBuilding] = useState<Building | null>(null);
  const [filterRole, setFilterRole] = useState<string>('');

  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', role: 'user', flat_no: '',
  });
  const [formBuilding, setFormBuilding] = useState<Building | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const params: any = {};
      if (filterBuilding) params.building_id = filterBuilding.id;
      if (filterRole) params.role = filterRole;
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/buildings/admin/users', { params });
      setUsers(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterBuilding, filterRole, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const createUser = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.role)
      return Alert.alert('Error', 'Name, email, password and role are required');
    setSubmitting(true);
    try {
      await api.post('/buildings/admin/users', {
        ...form,
        building_id: formBuilding?.id || null,
      });
      setShowAdd(false);
      setForm({ name: '', email: '', phone: '', password: '', role: 'user', flat_no: '' });
      setFormBuilding(null);
      fetchUsers();
      Alert.alert('Done', 'User created successfully');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteUser = (item: any) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/buildings/admin/users/${item.id}`);
              setUsers((prev) => prev.filter((u) => u.id !== item.id));
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.error || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardEmail}>{item.email}</Text>
          <View style={styles.cardMeta}>
            {item.flat_no ? (
              <View style={styles.metaChip}>
                <Ionicons name="home-outline" size={11} color={Colors.textMuted} />
                <Text style={styles.metaChipText}>Flat {item.flat_no}</Text>
              </View>
            ) : null}
            {item.buildings?.name ? (
              <View style={styles.metaChip}>
                <Ionicons name="business-outline" size={11} color={Colors.textMuted} />
                <Text style={styles.metaChipText}>{item.buildings.name}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLORS[item.role] || Colors.textMuted) + '20' }]}>
          <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] || Colors.textMuted }]}>
            {item.role}
          </Text>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteUser(item)}>
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Users</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="person-add" size={20} color={Colors.white} />
          <Text style={styles.addBtnText}>Add User</Text>
        </TouchableOpacity>
      </View>

      {/* Search + filters */}
      <View style={styles.filterSection}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={Colors.textMuted} style={{ marginLeft: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <BuildingDropdown
          buildings={buildings}
          loading={buildingsLoading}
          selected={filterBuilding}
          onSelect={setFilterBuilding}
          label="All Buildings"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleFilter}>
          {['', 'user', 'pramukh'].map((r) => (
            <TouchableOpacity
              key={r || 'all'}
              style={[styles.roleChip, filterRole === r && styles.roleChipActive]}
              onPress={() => setFilterRole(r)}
            >
              <Text style={[styles.roleChipText, filterRole === r && styles.roleChipTextActive]}>
                {r || 'All Roles'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={40} color={Colors.border} />
              <Text style={styles.empty}>No users found</Text>
            </View>
          }
        />
      )}

      {/* Add User Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add User</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Full name" autoCapitalize="words" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} placeholder="user@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="10-digit mobile" keyboardType="phone-pad" maxLength={10} placeholderTextColor={Colors.textMuted} />

            <Text style={styles.label}>Password *</Text>
            <View style={styles.passwordRow}>
              <TextInput style={styles.passwordInput} value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} placeholder="Min 8 characters" secureTextEntry={!showPassword} placeholderTextColor={Colors.textMuted} />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={{ paddingHorizontal: 12 }}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Role *</Text>
            <View style={styles.roleOptions}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleOption, form.role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] }]}
                  onPress={() => setForm({ ...form, role: r })}
                >
                  <Text style={[styles.roleOptionText, form.role === r && { color: Colors.white }]}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Assign to Building</Text>
            <BuildingDropdown buildings={buildings} loading={buildingsLoading} selected={formBuilding} onSelect={setFormBuilding} label="Select Building (optional)" />

            <Text style={styles.label}>Flat No.</Text>
            <TextInput style={styles.input} value={form.flat_no} onChangeText={(v) => setForm({ ...form, flat_no: v })} placeholder="e.g. A-101" placeholderTextColor={Colors.textMuted} />

            <TouchableOpacity style={styles.submitBtn} onPress={createUser} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create User</Text>}
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
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  filterSection: { backgroundColor: Colors.white, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border },
  searchInput: { flex: 1, padding: 10, fontSize: 14, color: Colors.text },
  roleFilter: { flexDirection: 'row' },
  roleChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bg, marginRight: 8, borderWidth: 1.5, borderColor: Colors.border },
  roleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleChipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  roleChipTextActive: { color: Colors.white },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  cardMeta: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  metaChipText: { fontSize: 11, color: Colors.textMuted },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { fontSize: 11, fontWeight: '700' },
  deleteBtn: { padding: 6 },
  emptyBox: { alignItems: 'center', paddingTop: 48, gap: 10 },
  empty: { color: Colors.textMuted, fontSize: 15 },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.bg },
  passwordInput: { flex: 1, padding: 12, fontSize: 15, color: Colors.text },
  roleOptions: { flexDirection: 'row', gap: 10 },
  roleOption: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  roleOptionText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
