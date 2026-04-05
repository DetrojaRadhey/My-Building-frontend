import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

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
  meeting: '/meetings',
  join_request: '/join-requests',
  join_response: '/join-requests',
  parking_report: '/parking',
};

export default function HomeScreen() {
  const { user, hasActiveSubscription } = useAuth();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});

  const isPendingUser = user?.role === 'user' && !user?.building_id;
  const needsSubscription = user?.role !== 'admin' && !hasActiveSubscription;

  const handleModuleTap = (route: string) => {
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
    router.push(route as any);
  };

  const allModules = [
    { title: 'My Details', icon: 'person-circle', color: '#1E3A8A', route: '/my-details', userPramukhOnly: true },
    { title: 'Members', icon: 'people-circle', color: '#0891B2', route: '/members', userPramukhOnly: true },
    { title: 'Expenses', icon: 'wallet', color: '#7C3AED', route: '/expenses' },
    { title: 'Maintenance', icon: 'wallet', color: '#10B981', route: '/maintenance' },
    { title: 'Announcements', icon: 'megaphone', color: '#F59E0B', route: '/announcements' },
    { title: 'Visitors', icon: 'people', color: '#6366F1', route: '/visitors' },
    { title: 'Parking', icon: 'car', color: '#0EA5E9', route: '/parking' },
    { title: 'Group Chat', icon: 'chatbubbles', color: '#EC4899', route: '/chat', hideForAdmin: true },
    { title: 'Complaints', icon: 'warning', color: '#EF4444', route: '/complaints?view=society', userPramukhOnly: true },
    { title: 'Join Requests', icon: 'person-add', color: '#059669', route: '/join-requests', pramukhOnly: true },
    { title: 'Helpline', icon: 'call', color: '#EF4444', route: '/helpline', hideForAdmin: true },
    { title: 'Subscription', icon: 'card', color: '#F59E0B', route: '/subscribe', hideForAdmin: true },
    { title: 'Bank Details', icon: 'business', color: '#7C3AED', route: '/bank-details', adminOnly: true },
    { title: 'Admin Panel', icon: 'shield-checkmark', color: '#7C3AED', route: '/admin', adminOnly: true },
    { title: 'Users', icon: 'people', color: '#0F766E', route: '/users', adminOnly: true },
    { title: 'Inquiries', icon: 'mail-open', color: '#0891B2', route: '/inquiries', adminOnly: true },
    { title: 'Complaints', icon: 'warning', color: '#EF4444', route: '/complaints-admin', adminOnly: true },
    { title: 'Helpline', icon: 'call', color: '#EF4444', route: '/helpline', adminOnly: true },
    { title: 'Subscriptions', icon: 'card', color: '#7C3AED', route: '/subscriptions-admin', adminOnly: true },
    { title: 'Promo Codes', icon: 'pricetag', color: '#EC4899', route: '/promos', adminOnly: true },
  ];

  const modules = allModules.filter((m: any) => {
    if (m.userPramukhOnly && user?.role !== 'user' && user?.role !== 'pramukh') return false;
    if (m.hideForAdmin && user?.role === 'admin') return false;
    if (m.adminOnly && user?.role !== 'admin') return false;
    if (m.pramukhOnly && user?.role !== 'pramukh') return false;
    if (m.hideIfSubscribed && hasActiveSubscription) return false;
    return true;
  });

  const fetchData = async () => {
    try {
      if (user?.building_id) {
        const res = await api.get('/announcements');
        setAnnouncements(res.data.slice(0, 3));
      }
    } catch {}
  };

  const fetchBadges = useCallback(async () => {
    if (!user?.building_id && user?.role !== 'admin') return;
    try {
      const res = await api.get('/notifications/unread-counts');
      // Aggregate counts by route
      const routeCounts: Record<string, number> = {};
      for (const [type, count] of Object.entries(res.data as Record<string, number>)) {
        const route = TYPE_TO_ROUTE[type];
        if (route) routeCounts[route] = (routeCounts[route] || 0) + count;
      }
      setBadgeCounts(routeCounts);
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
            <Text style={styles.greeting}>Welcome,</Text>
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
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day,</Text>
          <Text style={styles.name}>{user?.name} 👋</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{user?.role?.toUpperCase()}</Text></View>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile' as any)} style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Modules</Text>
      <View style={styles.grid}>
        {modules.map((m) => {
          const count = badgeCounts[m.route] || 0;
          const isLocked = needsSubscription && GATED_ROUTES.includes(m.route);
          return (
            <TouchableOpacity key={m.title} style={[styles.moduleCard, isLocked && styles.moduleCardLocked]} onPress={() => handleModuleTap(m.route)}>
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

      {announcements.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Announcements</Text>
          {announcements.map((a) => (
            <View key={a.id} style={[styles.announcementCard, a.priority === 'urgent' && styles.urgentCard]}>
              <View style={styles.announcementRow}>
                <Text style={styles.announcementIcon}>{a.priority === 'urgent' ? '🚨' : '📢'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.announcementTitle}>{a.title}</Text>
                  <Text style={styles.announcementBody} numberOfLines={2}>{a.body}</Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
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
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginHorizontal: 16, marginTop: 24, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  moduleCard: { width: '30%', margin: '1.5%', backgroundColor: Colors.white, borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  moduleIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  moduleTitle: { fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  moduleCardLocked: { opacity: 0.6 },
  lockBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: Colors.textMuted, borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.white },
  notifBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: Colors.danger, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: Colors.white },
  notifBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  announcementCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.white, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  urgentCard: { borderLeftWidth: 4, borderLeftColor: Colors.danger },
  announcementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  announcementIcon: { fontSize: 20 },
  announcementTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  announcementBody: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  pendingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 40 },
  pendingTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 10 },
  pendingSubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  joinBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  registerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 12 },
  registerBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
});
