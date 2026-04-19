import React, { useEffect, useState, useCallback } from 'react';
import { Colors } from '../../constants/colors';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Modal, TextInput, Dimensions, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { useActivityLog } from '../../hooks/useActivityLog';
import { cacheManager } from '../../utils/CacheManager';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_SIZE = (SCREEN_W - 48) / 3;

const GATED_ROUTES = [
  '/maintenance', '/announcements', '/visitors',
  '/parking', '/chat', '/join-requests', '/my-details', '/helpline',
  '/members', '/expenses',
];

const TYPE_TO_ROUTE: Record<string, string> = {
  bill: '/maintenance', payment: '/maintenance', reminder: '/maintenance',
  visitor: '/visitors', announcement: '/announcements',
  announcement_urgent: '/announcements_urgent',
  meeting: '/meetings', join_request: '/join-requests',
  join_response: '/join-requests', parking_report: '/parking',
};

// Pastel bg + icon color pairs matching the reference design
const MODULE_PALETTE: Record<string, { bg: string; icon: string }> = {
  myDetails:     { bg: '#E8EEF9', icon: '#3B5FC0' },
  members:       { bg: '#FFF3E0', icon: '#F59E0B' },
  complaints:    { bg: '#FDE8E8', icon: '#EF4444' },
  maintenance:   { bg: '#FFF3E0', icon: '#F59E0B' },
  visitors:      { bg: '#EDE9FE', icon: '#7C3AED' },
  parking:       { bg: '#E0F7F4', icon: '#0D9488' },
  groupChat:     { bg: '#FEE2E2', icon: '#EF4444' },
  helpline:      { bg: '#E0F2FE', icon: '#0EA5E9' },
  subscription:  { bg: '#FEF9C3', icon: '#CA8A04' },
  announcements: { bg: '#E0F2FE', icon: '#0EA5E9' },
  expenses:      { bg: '#EDE9FE', icon: '#7C3AED' },
  joinRequests:  { bg: '#DCFCE7', icon: '#16A34A' },
  bankDetails:   { bg: '#EDE9FE', icon: '#7C3AED' },
  adminPanel:    { bg: '#E8EEF9', icon: '#3B5FC0' },
  users:         { bg: '#E0F7F4', icon: '#0D9488' },
  inquiries:     { bg: '#E0F2FE', icon: '#0EA5E9' },
  subscriptions: { bg: '#FEF9C3', icon: '#CA8A04' },
  promoCodes:    { bg: '#FDE8E8', icon: '#EF4444' },
  activityLogs:  { bg: '#F1F5F9', icon: '#475569' },
  referAndEarn:  { bg: '#FFF0F5', icon: '#EC4899' },
  newspaper:     { bg: '#FFF7ED', icon: '#EA580C' },
  societyRules:  { bg: '#F0FDF4', icon: '#16A34A' },
};

const MODULE_ICONS: Record<string, string> = {
  myDetails: 'person-outline', members: 'people-outline',
  complaints: 'alert-circle-outline', maintenance: 'construct-outline',
  visitors: 'eye-outline', parking: 'car-outline',
  groupChat: 'chatbubble-ellipses-outline', helpline: 'call-outline',
  subscription: 'card-outline', announcements: 'megaphone-outline',
  expenses: 'wallet-outline', joinRequests: 'person-add-outline',
  bankDetails: 'business-outline', adminPanel: 'shield-checkmark-outline',
  users: 'people-circle-outline', inquiries: 'mail-open-outline',
  subscriptions: 'card-outline', promoCodes: 'pricetag-outline',
  activityLogs: 'list-circle-outline',
  referAndEarn: 'gift-outline',
  newspaper: 'newspaper-outline',
  societyRules: 'book-outline',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { t } = useLanguage();
  const { user, hasActiveSubscription, subscription: authSubscription } = useAuth();
  const router = useRouter();
  const { logEvent } = useActivityLog();
  const [refreshing, setRefreshing] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const [latestAnnouncement, setLatestAnnouncement] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [buildingLogo, setBuildingLogo] = useState<string | null>(null);

  const isPendingUser = user?.role === 'user' && !user?.building_id;
  const needsSubscription = user?.role !== 'admin' && !hasActiveSubscription;

  // Use subscription from AuthContext (already fetched at login) — no separate fetch needed
  // This prevents the lock flicker on first render
  const subscription = authSubscription as any;

  const hasNewspaperAddon =
    subscription?.status === 'active' &&
    subscription?.newspaper_addon === true &&
    (!subscription?.expires_at || new Date(subscription.expires_at) > new Date());

  const handleModuleTap = (route: string, titleKey: string) => {
    if (route === '/newspaper' && user?.role !== 'admin' && !hasNewspaperAddon) {
      Alert.alert(
        t('subscriptionRequired'),
        'The Newspaper module requires an active subscription with the Newspaper add-on.',
        [
          { text: t('notNow'), style: 'cancel' },
          { text: t('viewPlans'), onPress: () => router.push('/subscribe' as any) },
        ]
      );
      return;
    }
    if (needsSubscription && GATED_ROUTES.includes(route)) {
      Alert.alert(t('subscriptionRequired'), t('subscriptionRequiredMsg'), [
        { text: t('notNow'), style: 'cancel' },
        { text: t('viewPlans'), onPress: () => router.push('/subscribe' as any) },
      ]);
      return;
    }
    logEvent(`tap_module_${titleKey}`, route.replace('/', '') || 'home');
    router.push(route as any);
  };

  const allModules = [
    { titleKey: 'myDetails',    route: '/my-details',           userPramukhOnly: true },
    { titleKey: 'members',      route: '/members',              userPramukhOnly: true },
    { titleKey: 'expenses',     route: '/expenses' },
    { titleKey: 'maintenance',  route: '/maintenance' },
    { titleKey: 'announcements',route: '/announcements' },
    { titleKey: 'visitors',     route: '/visitors' },
    { titleKey: 'parking',      route: '/parking' },
    { titleKey: 'groupChat',    route: '/chat',                 hideForAdmin: true },
    { titleKey: 'complaints',   route: '/complaints?view=society', userPramukhOnly: true },
    { titleKey: 'joinRequests', route: '/join-requests',        pramukhOnly: true },
    { titleKey: 'helpline',     route: '/helpline',             hideForAdmin: true },
    { titleKey: 'subscription', route: '/subscribe',            hideForAdmin: true },
    { titleKey: 'bankDetails',  route: '/bank-details',         adminOnly: true },
    { titleKey: 'adminPanel',   route: '/admin',                adminOnly: true },
    { titleKey: 'users',        route: '/users',                adminOnly: true },
    { titleKey: 'inquiries',    route: '/inquiries',            adminOnly: true },
    { titleKey: 'complaints',   route: '/complaints-admin',     adminOnly: true },
    { titleKey: 'helpline',     route: '/helpline',             adminOnly: true },
    { titleKey: 'subscriptions',route: '/subscriptions-admin',  adminOnly: true },
    { titleKey: 'promoCodes',   route: '/promos',               adminOnly: true },
    { titleKey: 'activityLogs', route: '/activity-logs',        adminOnly: true },
    { titleKey: 'referAndEarn', route: '/refer-and-earn' },
    { titleKey: 'newspaper',    route: '/newspaper' },
    { titleKey: 'societyRules', route: '/society-rules' },
  ];

  const modules = allModules.filter((m: any) => {
    if (m.userPramukhOnly && user?.role !== 'user' && user?.role !== 'pramukh') return false;
    if (m.hideForAdmin && user?.role === 'admin') return false;
    if (m.adminOnly && user?.role !== 'admin') return false;
    if (m.pramukhOnly && user?.role !== 'pramukh') return false;
    return true;
  }).map(m => ({ ...m, title: t(m.titleKey) }));

  const filteredModules = search.trim()
    ? modules.filter(m => m.title.toLowerCase().includes(search.toLowerCase()))
    : modules;

  const fetchData = async () => {
    try {
      if (user?.building_id) {
        const [announcementsRes, buildingRes] = await Promise.all([
          api.get('/announcements'),
          api.get('/buildings/my').catch(() => null),
        ]);
        const all = announcementsRes.data as any[];
        setLatestAnnouncement(all[0] || null);
        setBuildingLogo(buildingRes?.data?.society_logo ?? null);
      }
    } catch {}
  };

  const openUrgentInbox = async () => {
    api.patch('/notifications/read-all').catch(() => {});
    api.delete('/notifications/dismiss-types', { data: { types: ['announcement_urgent'] } }).catch(() => {});
    setTotalUnread(0);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data as any[]);
    } catch { setNotifications([]); }
    setShowUrgentModal(true);
  };

  const dismissUrgentInbox = () => { setShowUrgentModal(false); setNotifications([]); };

  const fetchBadges = useCallback(async () => {
    if (!user?.building_id && user?.role !== 'admin') return;
    try {
      const res = await api.get('/notifications/unread-counts');
      const routeCounts: Record<string, number> = {};
      for (const [type, count] of Object.entries(res.data as Record<string, number>)) {
        const route = TYPE_TO_ROUTE[type];
        if (route) routeCounts[route] = (routeCounts[route] || 0) + count;
      }
      const total = Object.values(routeCounts).reduce((sum, n) => sum + n, 0);
      setTotalUnread(total);
      setBadgeCounts(routeCounts);
    } catch {}
  }, [user]);

  useEffect(() => { fetchData(); }, [user?.building_id]);
  useFocusEffect(useCallback(() => { fetchBadges(); }, [fetchBadges]));

  const onRefresh = async () => {
    setRefreshing(true);
    // Invalidate all module caches on home screen pull-to-refresh
    await cacheManager.invalidate('announcements:*');
    await cacheManager.invalidate('maintenance:*');
    await cacheManager.invalidate('visitors:*');
    await cacheManager.invalidate('newspaper:*');
    await Promise.all([fetchData(), fetchBadges()]);
    setRefreshing(false);
  };

  if (isPendingUser) {
    return (
      <View style={styles.container}>
        <View style={styles.gradientHeader}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.push('/profile' as any)} style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
            </TouchableOpacity>
            <Text style={styles.greetingText}>{t('welcome')}, {user?.name}</Text>
          </View>
        </View>
        <View style={styles.pendingContainer}>
          <Ionicons name="business-outline" size={64} color={Colors.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.pendingTitle}>{t('notInBuilding')}</Text>
          <Text style={styles.pendingSubtitle}>{t('notInBuildingSub')}</Text>
          <TouchableOpacity style={styles.joinBtn} onPress={() => router.push('/join' as any)}>
            <Ionicons name="enter-outline" size={20} color={Colors.white} />
            <Text style={styles.joinBtnText}>{t('joinBuilding')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.registerBtn} onPress={() => router.push('/register-building' as any)}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.registerBtnText}>{t('registerBuilding')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Gradient Header ── */}
        <View style={styles.gradientHeader}>
          {/* Top row: avatar + bell */}
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.push('/profile' as any)} style={styles.avatarCircle}>
              {buildingLogo
                ? <Image source={{ uri: buildingLogo }} style={styles.avatarImg} />
                : <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={openUrgentInbox} style={styles.bellBtn}>
              <Ionicons name="notifications-outline" size={22} color={Colors.white} />
              {totalUnread > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Greeting */}
          <Text style={styles.greetingText}>{getGreeting()}, {user?.name?.split(' ')[0]} 👋</Text>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search modules..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Module Grid ── */}
        <View style={styles.gridSection}>
          <View style={styles.grid}>
            {filteredModules.map((m) => {
              const count = badgeCounts[m.route] || 0;
              const isNewspaperLocked = m.route === '/newspaper' && user?.role !== 'admin' && !hasNewspaperAddon;
              const isLocked = isNewspaperLocked || (needsSubscription && GATED_ROUTES.includes(m.route));
              const palette = MODULE_PALETTE[m.titleKey] || { bg: '#F1F5F9', icon: Colors.primary };
              const iconName = MODULE_ICONS[m.titleKey] || 'grid-outline';
              return (
                <TouchableOpacity
                  key={`${m.titleKey}-${m.route}`}
                  testID={`module-tile-${m.route}`}
                  style={[styles.moduleCard, isLocked && styles.moduleCardLocked]}
                  onPress={() => handleModuleTap(m.route, m.titleKey)}
                  activeOpacity={0.75}
                >
                  <View style={{ position: 'relative' }}>
                    <View style={[styles.moduleIconCircle, { backgroundColor: palette.bg }]}>
                      <Ionicons
                        name={iconName as any}
                        size={26}
                        color={isLocked ? Colors.textMuted : palette.icon}
                      />
                    </View>
                    {count > 0 && !isLocked && (
                      <View style={styles.notifBadge}>
                        <Text style={styles.notifBadgeText}>{count > 99 ? '99+' : count}</Text>
                      </View>
                    )}
                    {isLocked && (
                      <View testID={`lock-badge-${m.route}`} style={styles.lockBadge}>
                        <Ionicons name="lock-closed" size={9} color={Colors.white} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.moduleTitle, isLocked && { color: Colors.textMuted }]} numberOfLines={2}>
                    {m.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Notifications Inbox Modal */}
      <Modal visible={showUrgentModal} transparent animationType="slide" onRequestClose={dismissUrgentInbox}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={dismissUrgentInbox}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>� {t('notifications')}</Text>
              <TouchableOpacity onPress={dismissUrgentInbox}>
                <Ionicons name="close-circle" size={26} color={Colors.border} />
              </TouchableOpacity>
            </View>
            {notifications.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="checkmark-circle-outline" size={44} color={Colors.success} />
                <Text style={styles.modalEmptyText}>{t('noNotifications')}</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {notifications.map((n) => (
                  <View key={n.id} style={styles.urgentCard}>
                    <View style={styles.urgentCardTop}>
                      <Text style={styles.urgentCardTitle}>{n.title}</Text>
                      <View style={[styles.urgentBadge, { backgroundColor: Colors.primary }]}>
                        <Text style={styles.urgentBadgeText}>{(n.type || '').replace(/_/g, ' ').toUpperCase()}</Text>
                      </View>
                    </View>
                    {!!n.body && <Text style={styles.urgentCardBody}>{n.body}</Text>}
                    <Text style={styles.urgentCardMeta}>
                      {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // ── Gradient header ──────────────────────────────────────────────────────
  gradientHeader: {
    paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    backgroundColor: '#3B5FC0',
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
  },
  avatarText: { color: Colors.white, fontSize: 20, fontWeight: '800' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  bellBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  bellBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: Colors.danger, borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: '#6366F1' },
  bellBadgeText: { color: Colors.white, fontSize: 9, fontWeight: '800' },
  greetingText: { color: Colors.white, fontSize: 22, fontWeight: '800', marginBottom: 16 },

  // ── Search ───────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  // ── Announcement banner ──────────────────────────────────────────────────
  announceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  announceAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  announceName: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  announceSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  announceArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Module grid ──────────────────────────────────────────────────────────
  gridSection: { paddingHorizontal: 16, paddingTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  moduleCard: {
    width: CARD_SIZE, alignItems: 'center',
    paddingVertical: 18, paddingHorizontal: 4,
  },
  moduleIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  moduleTitle: { fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center', lineHeight: 16 },
  moduleCardLocked: { opacity: 0.5 },
  lockBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: Colors.textMuted, borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#F8FAFC' },
  notifBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: Colors.danger, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#F8FAFC' },
  notifBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },

  // ── Pending state ────────────────────────────────────────────────────────
  pendingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 40 },
  pendingTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 10 },
  pendingSubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  joinBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  registerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 12 },
  registerBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },

  // ── Urgent modal ─────────────────────────────────────────────────────────
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

