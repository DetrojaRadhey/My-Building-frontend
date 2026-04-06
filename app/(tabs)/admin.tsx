import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import api from '../../utils/api';
import BuildingDropdown from '../../components/BuildingDropdown';
import type { Building } from '../../hooks/useBuildings';

type ModalType = 'none' | 'createBuilding' | 'createPramukh' | 'members' | 'subscriptions' | 'grantSub';
type Member = { id: string; name: string; email: string; role: string; flat_no?: string; status: string };
type SubRecord = {
  id: string; user_id: string; plan: string; status: string;
  started_at: string; expires_at: string | null; remark: string | null;
  razorpay_payment_id: string | null;
  users: { name: string; email: string; role: string; buildings: { name: string } | null } | null;
};

function ActionCard({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.actionCard, { borderColor: color + '40' }]} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={26} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalType>('none');
  const [submitting, setSubmitting] = useState(false);

  // create building form
  const [bForm, setBForm] = useState({ name: '', address: '' });

  // create pramukh form
  const [pBuilding, setPBuilding] = useState<Building | null>(null);
  const [pForm, setPForm] = useState({ name: '', email: '', password: '' });

  // members
  const [membersBuilding, setMembersBuilding] = useState<Building | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // subscriptions
  const [subs, setSubs] = useState<SubRecord[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [grantForm, setGrantForm] = useState({ user_id: '', plan: 'monthly', months: '1', remark: '' });
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  React.useEffect(() => { fetchBuildings(); }, []);

  const fetchBuildings = async () => {
    try { const r = await api.get('/buildings'); setBuildings(r.data); }
    catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const closeModal = () => setModal('none');

  const createBuilding = async () => {
    if (!bForm.name.trim()) return Alert.alert('Error', 'Building name is required');
    setSubmitting(true);
    try {
      await api.post('/buildings/create', { name: bForm.name.trim(), address: bForm.address.trim() });
      setBForm({ name: '', address: '' });
      closeModal();
      fetchBuildings();
      Alert.alert('Done', 'Building created');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const createPramukh = async () => {
    if (!pBuilding) return Alert.alert('Error', 'Select a building');
    if (!pForm.name.trim() || !pForm.email.trim() || !pForm.password.trim())
      return Alert.alert('Error', 'All fields are required');
    setSubmitting(true);
    try {
      await api.post('/buildings/pramukh', {
        building_id: pBuilding.id,
        name: pForm.name.trim(),
        email: pForm.email.trim().toLowerCase(),
        password: pForm.password,
      });
      setPForm({ name: '', email: '', password: '' });
      setPBuilding(null);
      closeModal();
      Alert.alert('Done', 'Pramukh created');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const openMembers = async (b: Building) => {
    setMembersBuilding(b);
    setModal('members');
    setMembersLoading(true);
    try { const r = await api.get(`/buildings/members/${b.id}`); setMembers(r.data); }
    catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
    finally { setMembersLoading(false); }
  };

  const openSubscriptions = async () => {
    setModal('subscriptions');
    setSubsLoading(true);
    try { const r = await api.get('/subscriptions/all'); setSubs(r.data); }
    catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
    finally { setSubsLoading(false); }
  };

  const openGrantSub = async () => {
    // load all users for picker
    try { const r = await api.get('/buildings'); 
      // fetch members from all buildings
      const all: { id: string; name: string; email: string }[] = [];
      for (const b of r.data) {
        const m = await api.get(`/buildings/members/${b.id}`);
        m.data.forEach((u: any) => { if (!all.find(x => x.id === u.id)) all.push({ id: u.id, name: u.name, email: u.email }); });
      }
      setAllUsers(all);
    } catch {}
    setGrantForm({ user_id: '', plan: 'monthly', months: '1', remark: '' });
    setModal('grantSub');
  };

  const grantSubscription = async () => {
    if (!grantForm.user_id) return Alert.alert('Error', 'Select a user');
    if (!grantForm.remark.trim()) return Alert.alert('Error', 'Remark is required — add who is handling this');
    setSubmitting(true);
    try {
      await api.post('/subscriptions/grant', {
        user_id: grantForm.user_id,
        plan: grantForm.plan,
        months: grantForm.plan === 'monthly' ? Number(grantForm.months) : undefined,
        remark: grantForm.remark.trim(),
      });
      closeModal();
      Alert.alert('Done', 'Subscription granted');
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const revokeSubscription = async (user_id: string, name: string) => {
    Alert.alert('Revoke Subscription', `Revoke subscription for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        try {
          await api.post('/subscriptions/revoke', { user_id });
          setSubs(prev => prev.map(s => s.user_id === user_id ? { ...s, status: 'cancelled' } : s));
        } catch (e: any) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
      }},
    ]);
  };

  const navigateTo = (route: string, b: Building) => {
    router.push({ pathname: route as any, params: { building_id: b.id, building_name: b.name } });
  };

  const roleColor = (r: string) =>
    r === 'pramukh' ? Colors.primary : r === 'user' ? Colors.success : Colors.textMuted;

  const BUILD_ACTIONS = [
    { route: '/(tabs)/maintenance',   icon: 'wallet',       color: '#10B981', label: 'Maintenance' },
    { route: '/(tabs)/announcements', icon: 'megaphone',    color: '#F59E0B', label: 'Notices' },
    { route: '/(tabs)/visitors',      icon: 'people',       color: '#6366F1', label: 'Visitors' },
    { route: '/(tabs)/parking',       icon: 'car',          color: '#0EA5E9', label: 'Parking' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSub}>{buildings.length} building{buildings.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBuildings(); }} />}
        >
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <ActionCard icon="business"    label="New Building"   color={Colors.primary} onPress={() => setModal('createBuilding')} />
            <ActionCard icon="person-add"  label="New Pramukh"    color="#7C3AED"        onPress={() => setModal('createPramukh')} />
          </View>
          <View style={styles.actionsRow}>
            <ActionCard icon="card"        label="Subscriptions"  color="#0EA5E9"        onPress={openSubscriptions} />
            <ActionCard icon="gift"        label="Grant Sub"      color="#10B981"        onPress={openGrantSub} />
          </View>

          <Text style={styles.sectionTitle}>Buildings</Text>
          {buildings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏢</Text>
              <Text style={styles.emptyTitle}>No buildings yet</Text>
              <Text style={styles.emptyText}>Create your first building above</Text>
            </View>
          ) : buildings.map((b) => (
            <View key={b.id} style={styles.buildingCard}>
              <View style={styles.buildingTop}>
                <View style={styles.buildingIconBox}><Text style={{ fontSize: 22 }}>🏢</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.buildingName}>{b.name}</Text>
                  {b.address ? <Text style={styles.buildingAddr}>{b.address}</Text> : null}
                </View>
                <TouchableOpacity style={styles.membersBtn} onPress={() => openMembers(b)}>
                  <Ionicons name="people" size={14} color={Colors.primary} />
                  <Text style={styles.membersBtnText}>Members</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.buildingActions}>
                {BUILD_ACTIONS.map((item) => (
                  <TouchableOpacity
                    key={item.route}
                    style={[styles.miniBtn, { backgroundColor: item.color + '15' }]}
                    onPress={() => navigateTo(item.route, b)}
                  >
                    <Ionicons name={item.icon as any} size={16} color={item.color} />
                    <Text style={[styles.miniLabel, { color: item.color }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Create Building ── */}
      <Modal visible={modal === 'createBuilding'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Building</Text>
            <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Building Name *</Text>
            <TextInput style={styles.input} value={bForm.name} onChangeText={(v) => setBForm({ ...bForm, name: v })} placeholder="e.g. Shree Residency" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={bForm.address} onChangeText={(v) => setBForm({ ...bForm, address: v })} placeholder="e.g. 12, MG Road, Ahmedabad" placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={styles.submitBtn} onPress={createBuilding} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Building</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Create Pramukh ── */}
      <Modal visible={modal === 'createPramukh'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Pramukh</Text>
            <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <BuildingDropdown buildings={buildings} loading={false} selected={pBuilding} onSelect={setPBuilding} label="Assign to Building *" />
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={pForm.name} onChangeText={(v) => setPForm({ ...pForm, name: v })} placeholder="Full name" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} value={pForm.email} onChangeText={(v) => setPForm({ ...pForm, email: v })} placeholder="pramukh@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.textMuted} />
            <Text style={styles.label}>Password *</Text>
            <TextInput style={styles.input} value={pForm.password} onChangeText={(v) => setPForm({ ...pForm, password: v })} placeholder="Min 6 characters" secureTextEntry placeholderTextColor={Colors.textMuted} />
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#7C3AED' }]} onPress={createPramukh} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Pramukh</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Members ── */}
      <Modal visible={modal === 'members'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{membersBuilding?.name}</Text>
              <Text style={styles.modalSub}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity onPress={() => { setModal('none'); setMembersBuilding(null); setMembers([]); }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          {membersLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
          ) : (
            <FlatList
              data={members}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={styles.empty}>No members yet</Text>}
              renderItem={({ item }) => (
                <View style={styles.memberCard}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{item.name?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{item.name}</Text>
                    <Text style={styles.memberEmail}>{item.email}</Text>
                    {item.flat_no && <Text style={styles.memberFlat}>Flat {item.flat_no}</Text>}
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor(item.role) + '20' }]}>
                    <Text style={[styles.roleText, { color: roleColor(item.role) }]}>{item.role}</Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* ── All Subscriptions ── */}
      <Modal visible={modal === 'subscriptions'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Subscriptions</Text>
              <Text style={styles.modalSub}>{subs.length} total</Text>
            </View>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          {subsLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
          ) : (
            <FlatList
              data={subs}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={styles.empty}>No subscriptions yet</Text>}
              renderItem={({ item }) => {
                const isActive = item.status === 'active';
                const isLifetime = item.plan === 'lifetime';
                const isAdminGrant = item.razorpay_payment_id === 'admin_grant';
                const statusColor = isActive ? Colors.success : item.status === 'expired' ? '#F59E0B' : Colors.danger;
                return (
                  <View style={styles.subCard}>
                    <View style={styles.subCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{item.users?.name || '—'}</Text>
                        <Text style={styles.memberEmail}>{item.users?.email || '—'}</Text>
                        {item.users?.buildings?.name && (
                          <Text style={styles.memberFlat}>{item.users.buildings.name}</Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={[styles.roleBadge, { backgroundColor: statusColor + '20' }]}>
                          <Text style={[styles.roleText, { color: statusColor }]}>{item.status}</Text>
                        </View>
                        <Text style={styles.subPlan}>{isLifetime ? '♾ Lifetime' : '📅 Monthly'}</Text>
                        {isAdminGrant && <Text style={styles.subGranted}>Admin Grant</Text>}
                      </View>
                    </View>

                    {/* Remark row */}
                    {item.remark ? (
                      <View style={styles.remarkRow}>
                        <Ionicons name="chatbox-ellipses-outline" size={14} color="#7C3AED" />
                        <Text style={styles.remarkText}>{item.remark}</Text>
                      </View>
                    ) : (
                      <View style={styles.remarkRow}>
                        <Ionicons name="chatbox-ellipses-outline" size={14} color={Colors.textMuted} />
                        <Text style={[styles.remarkText, { color: Colors.textMuted, fontStyle: 'italic' }]}>No remark</Text>
                      </View>
                    )}

                    {!isLifetime && item.expires_at && (
                      <Text style={styles.subExpiry}>
                        Expires: {new Date(item.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    )}

                    {isActive && (
                      <TouchableOpacity
                        style={styles.revokeBtn}
                        onPress={() => revokeSubscription(item.user_id, item.users?.name || 'user')}
                      >
                        <Ionicons name="close-circle-outline" size={14} color={Colors.danger} />
                        <Text style={styles.revokeBtnText}>Revoke</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* ── Grant Subscription ── */}
      <Modal visible={modal === 'grantSub'} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Grant Subscription</Text>
            <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>User *</Text>
            <View style={styles.pickerBox}>
              {allUsers.length === 0
                ? <Text style={{ color: Colors.textMuted, padding: 12 }}>Loading users...</Text>
                : allUsers.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.pickerItem, grantForm.user_id === u.id && styles.pickerItemActive]}
                    onPress={() => setGrantForm({ ...grantForm, user_id: u.id })}
                  >
                    <Text style={[styles.pickerItemText, grantForm.user_id === u.id && { color: Colors.white }]}>
                      {u.name} — {u.email}
                    </Text>
                  </TouchableOpacity>
                ))
              }
            </View>

            <Text style={styles.label}>Plan *</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {['monthly', 'yearly', 'lifetime'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.planToggle, grantForm.plan === p && styles.planToggleActive]}
                  onPress={() => setGrantForm({ ...grantForm, plan: p })}
                >
                  <Text style={[styles.planToggleText, grantForm.plan === p && { color: Colors.white }]}>
                    {p === 'monthly' ? '📅 Monthly' : p === 'yearly' ? '⭐ Yearly' : '♾ Lifetime'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {grantForm.plan === 'monthly' && (              <>
                <Text style={styles.label}>Months *</Text>
                <TextInput
                  style={styles.input}
                  value={grantForm.months}
                  onChangeText={(v) => setGrantForm({ ...grantForm, months: v })}
                  placeholder="e.g. 1"
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textMuted}
                />
              </>
            )}

            <Text style={styles.label}>Remark * <Text style={{ fontWeight: '400', color: Colors.textMuted }}>(who handled this?)</Text></Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={grantForm.remark}
              onChangeText={(v) => setGrantForm({ ...grantForm, remark: v })}
              placeholder="e.g. Collected cash from client — handled by Ravi"
              placeholderTextColor={Colors.textMuted}
              multiline
            />

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#10B981' }]} onPress={grantSubscription} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Grant Subscription</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12, marginTop: 8 },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionCard: { flex: 1, backgroundColor: Colors.white, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  actionIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  buildingCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  buildingTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  buildingIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  buildingName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  buildingAddr: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  membersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  membersBtnText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  buildingActions: { flexDirection: 'row', gap: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  miniBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, gap: 4 },
  miniLabel: { fontSize: 10, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: Colors.white, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingTop: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 24, marginBottom: 30 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg, borderRadius: 12, padding: 14, marginBottom: 10 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  memberName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  memberEmail: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  memberFlat: { fontSize: 12, color: Colors.primary, marginTop: 2, fontWeight: '600' },
  roleBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 15 },
  // Subscription cards
  subCard: { backgroundColor: Colors.bg, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  subCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  subPlan: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  subGranted: { fontSize: 10, color: '#7C3AED', fontWeight: '700', backgroundColor: '#F3E8FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  subExpiry: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  remarkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#F5F3FF', borderRadius: 8, padding: 8, marginTop: 4 },
  remarkText: { fontSize: 13, color: '#7C3AED', fontWeight: '600', flex: 1 },
  revokeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-end' },
  revokeBtnText: { fontSize: 12, color: Colors.danger, fontWeight: '700' },
  // Grant sub
  pickerBox: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, overflow: 'hidden', marginBottom: 4 },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerItemActive: { backgroundColor: Colors.primary },
  pickerItemText: { fontSize: 14, color: Colors.text },
  planToggle: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  planToggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  planToggleText: { fontSize: 14, fontWeight: '700', color: Colors.text },
});
