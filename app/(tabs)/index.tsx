import React, { useEffect, useState, useCallback } from 'react';
import { Colors } from '../../constants/colors';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { useActivityLog } from '../../hooks/useActivityLog';

// Modules that require subscription to access
const GATED_ROUTES = [
  '/maintenance', '/announcements', '/visitors',
  '/parking', '/chat', '/join-requests', '/my-details', '/helpline',
  '/members', '/expenses',
];

// Map notification types → module route for badge counts
const TYPE_TO_ROUTE: Record<string, string> = {
  bill: '/maintenance',
  payment: '/maintenance',
  reminder: '/maintenance',
  visitor: '/visitors',
  announcement: '/announcements',
  announcement_urgent: '/announcements_urgent',
  meeting: '/meetings',
  join_request: '/join-requests',
  join_response: '/join-requests',
  parking_report: '/parking',
};

export default function HomeScreen() {
  const { t } = useLanguage();
  const { user, hasActiveSubscription } = useAuth();
  const router = useRouter();
  const { logEvent } = useActivityLog();
  const [refreshing, setRefreshing] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [urgentAnnouncements, setUrgentAnnouncements] = useState<any[]>([]);
  const [showUrgentModal, setShowUrgentModal] = useState(false);

  const isPendingUser = user?.role === 'user' && !user?.building_id;
  const needsSubscription = user?.role !== 'admin' && !hasActiveSubscription;

  const handleModuleTap = (route: string, title: string) => {
    if (needsSubscription && GATED_ROUTES.includes(route)) {
      Alert.alert(
        'Subscription Required',
        'You need an active subscription to access this module. Activate your plan to unlock all features.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'View Plans', onPress: () => router.push('/subscribe' as any) },
        ]
      );
      return;
    }
    logEvent(`tap_module_${title.toLowerCase().replace(/\s+/g, '_')}`, route.replace('/', '') || 'home');
    router.push(route as any);
  };

  const allModules = [
    { titleKey: 'myDetails', icon: 'person-circle', color: '#1E3A8A', route: '/my-details', userPramukhOnly: true },
    { titleKey: 'members', icon: 'people-circle', color: '#0891B2', route: '/members', userPramukhOnly: true },
    { titleKey: 'expenses', icon: 'wallet', color: '#7C3AED', route: '/expenses' },
    { titleKey: 'maintenance', icon: 'wallet', color: '#10B981', route: '/maintenance' },
    { titleKey: 'announcements', icon: 'megaphone', color: '#F59E0B', route: '/announcements' },
    { titleKey: 'visitors', icon: 'people', color: '#6366F1', route: '/visitors' },
    { titleKey: 'parking', icon: 'car', color: '#0EA5E9', route: '/parking' },
    { titleKey: 'groupChat', icon: 'chatbubbles', color: '#EC4899', route: '/chat', hideForAdmin: true },
    { titleKey: 'complaints', icon: 'warning', color: '#EF4444', route: '/complaints?view=society', userPramukhOnly: true },
    { titleKey: 'joinRequests', icon: 'person-add', color: '#059669', route: '/join-requests', pramukhOnly: true },
    { titleKey: 'helpline', icon: 'call', color: '#EF4444', route: '/helpline', hideForAdmin: true },
    { titleKey: 'subscription', icon: 'card', color: '#F59E0B', route: '/subscribe', hideForAdmin: true },
    { titleKey: 'bankDetails', icon: 'business', color: '#7C3AED', route: '/bank-details', adminOnly: true },
    { titleKey: 'adminPanel', icon: 'shield-checkmark', color: '#7C3AED', route: '/admin', adminOnly: true },
    { titleKey: 'users', icon: 'people', color: '#0F766E', route: '/users', adminOnly: true },
    { titleKey: 'inquiries', icon: 'mail-open', color: '#0891B2', route: '/inquiries', adminOnly: true },
    { titleKey: 'complaints', icon: 'warning', color: '#EF4444', route: '/complaints-admin', adminOnly: true },
    { titleKey: 'helpline', icon: 'call', color: '#EF4444', route: '/helpline', adminOnly: true },
    { titleKey: 'subscriptions', icon: 'card', color: '#7C3AED', route: '/subscriptions-admin', adminOnly: true },
    { titleKey: 'promoCodes', icon: 'pricetag', color: '#EC4899', route: '/promos', adminOnly: true },
    { titleKey: 'activityLogs', icon: 'list-circle', color: '#475569', route: '/activity-logs', adminOnly: true },
  ];

  const modules = allModules.filter((m: any) => {
    if (m.userPramukhOnly && user?.role !== 'user' && user?.role !== 'pramukh') return false;
    if (m.hideForAdmin && user?.role === 'admin') return false;
    if (m.adminOnly && user?.role !== 'admin') return false;
    if (m.pramukhOnly && user?.role !== 'pramukh') return false;
    if (m.hideIfSubscribed && hasActiveSubscription) return false;
    return true;
  }).map(m => ({ ...m, title: t(m.titleKey) }));

  const fetchData = async () => {
    // kept for pull-to-refresh compatibility
  };

  const openUrgentInbox = async () => {
    // Immediately delete the urgent notifications from DB — one-time read
    api.delete('/notifications/dismiss-types', { data: { types: ['announcement_urgent'] } }).catch(() => {});
    // Clear badge locally right away
    setBadgeCounts(prev => ({ ...prev, '/announcements_urgent': 0 }));

    try {
      const res = await api.get('/announcements');
      const urgent = (res.data as any[]).filter((a: any) => a.priority === 'urgent');
      setUrgentAnnouncements(urgent);
    } catch {
      setUrgentAnnouncements([]);
    }
    setShowUrgentModal(true);
  };

  const dismissUrgentInbox = () => {
    setShowUrgentModal(false);
    setUrgentAnnouncements([]);
  };

  const fetchBadges = useCallback(async () => {
    if (!user?.building_id && user?.role !== 'admin') return;
    try {
      const res = await api.get('/notifications/unread-counts');
      const routeCounts: Record<string, number> = {};
      for (const [type, count] of Object.entries(res.data as Record<string, number>)) {
        const route = TYPE_TO_ROUTE[type];
        if (route) routeCounts[route] = (routeCounts[route] || 0) + count;
      }
      // Never restore urgent badge once cleared — it was already deleted from DB
      routeCounts['/announcements_urgent'] = routeCounts['/announcements_urgent'] || 0;
      setBadgeCounts(prev => ({
        ...routeCounts,
        // Keep urgent at 0 if we already dismissed it this session
        '/announcements_urgent': prev['/announcements_urgent'] === 0 ? 0 : (routeCounts['/announcements_urgent'] || 0),
      }));
    } catch {}
  }, [user]);

  useEffect(() => { fetchData(); }, []);
  useFocusEffect(useCallback(() => { fetchBadges(); }, [fetchBadges]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), fetchBadges()]);
    setRefreshing(false);
  };

  

  if (isPendingUser) {
    return (
      <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t('welcome')}</Text>
            <Text style={styles.name}>{user?.name} 👋</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>USER</Text></View>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile' as any)} style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.pendingContainer}>
          <Ionicons name="business-outline" size={64} color={Colors.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.pendingTitle}>You're not in a building yet</Text>
          <Text style={styles.pendingSubtitle}>Join a building to access all features. Your Pramukh will approve your request.</Text>
          <TouchableOpacity style={styles.joinBtn} onPress={() => router.push('/join' as any)}>
            <Ionicons name="enter-outline" size={20} color={Colors.white} />
            <Text style={styles.joinBtnText}>Join a Building</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.registerBtn} onPress={() => router.push('/register-building' as any)}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.registerBtnText}>Register Your Building</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('goodDay')}</Text>
          <Text style={styles.name}>{user?.name} 👋</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{user?.role?.toUpperCase()}</Text></View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={openUrgentInbox} style={styles.inboxBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.white} />
            {(badgeCounts['/announcements_urgent'] || 0) > 0 && (
              <View style={styles.inboxBadge}>
                <Text style={styles.inboxBadgeText}>
                  {(badgeCounts['/announcements_urgent'] || 0) > 99 ? '99+' : badgeCounts['/announcements_urgent']}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile' as any)} style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t('modules')}</Text>
      <View style={styles.grid}>
        {modules.map((m) => {
          const count = badgeCounts[m.route] || 0;
          const isLocked = needsSubscription && GATED_ROUTES.includes(m.route);
          return (
            <TouchableOpacity key={m.title} style={[styles.moduleCard, isLocked && styles.moduleCardLocked]} onPress={() => handleModuleTap(m.route, m.title)}>
              <View style={{ position: 'relative' }}>
                <View style={[styles.moduleIcon, { backgroundColor: m.color + '20' }]}>
                  <Ionicons name={m.icon as any} size={28} color={isLocked ? Colors.textMuted : m.color} />
                </View>
                {count > 0 && !isLocked && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{count > 99 ? '99+' : count}</Text>
                  </View>
                )}
                {isLocked && (
                  <View style={styles.lockBadge}>
                    <Ionicons name="lock-closed" size={10} color={Colors.white} />
                  </View>
                )}
              </View>
              <Text style={[styles.moduleTitle, isLocked && { color: Colors.textMuted }]}>{m.title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>

    {/* Urgent Announcements Modal */}
    <Modal visible={showUrgentModal} transparent animationType="slide" onRequestClose={dismissUrgentInbox}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={dismissUrgentInbox}>
        <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalTitleRow}>
            <Text style={styles.modalTitle}>🚨 Urgent Announcements</Text>
            <TouchableOpacity onPress={dismissUrgentInbox}>
              <Ionicons name="close-circle" size={26} color={Colors.border} />
            </TouchableOpacity>
          </View>
          {urgentAnnouncements.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Ionicons name="checkmark-circle-outline" size={44} color={Colors.success} />
              <Text style={styles.modalEmptyText}>No urgent announcements</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {urgentAnnouncements.map((a) => (
                <View key={a.id} style={styles.urgentCard}>
                  <View style={styles.urgentCardTop}>
                    <Text style={styles.urgentCardTitle}>{a.title}</Text>
                    <View style={styles.urgentBadge}><Text style={styles.urgentBadgeText}>URGENT</Text></View>
                  </View>
                  <Text style={styles.urgentCardBody}>{a.body}</Text>
                  <Text style={styles.urgentCardMeta}>
                    {a.users?.name} · {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, padding: 24, paddingTop: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  name: { color: Colors.white, fontSize: 22, fontWeight: '800', marginTop: 2 },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6, alignSelf: 'flex-start' },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inboxBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  inboxBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: Colors.danger, borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: Colors.primary },
  inboxBadgeText: { color: Colors.white, fontSize: 9, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginHorizontal: 16, marginTop: 24, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  moduleCard: { width: '30%', margin: '1.5%', backgroundColor: Colors.white, borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  moduleIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  moduleTitle: { fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  moduleCardLocked: { opacity: 0.6 },
  lockBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: Colors.textMuted, borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white },
  notifBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: Colors.danger, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: Colors.white },
  notifBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  pendingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 40 },
  pendingTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 10 },
  pendingSubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  joinBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  registerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 12 },
  registerBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  // Urgent inbox modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '75%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  modalEmpty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  modalEmptyText: { fontSize: 15, color: Colors.textMuted },
  urgentCard: { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: Colors.danger },
  urgentCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  urgentCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  urgentBadge: { backgroundColor: Colors.danger, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  urgentBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  urgentCardBody: { fontSize: 14, color: Colors.text, lineHeight: 20, marginBottom: 6 },
  urgentCardMeta: { fontSize: 12, color: Colors.textMuted },
});
