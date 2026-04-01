import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { API_BASE } from '../constants/api';

const PLANS = [
  {
    key: 'monthly',
    title: 'Monthly Plan',
    price: '₹15',
    period: '/ month',
    desc: 'Billed every month. Cancel anytime.',
    icon: 'calendar-outline' as const,
    color: Colors.primary,
    features: ['Full access to all modules', 'Maintenance billing & payments', 'Visitor management', 'Complaints & announcements'],
  },
  {
    key: 'yearly',
    title: 'Yearly Plan',
    price: '₹150',
    period: '/ year',
    desc: 'Save ₹30 vs monthly. Billed annually.',
    icon: 'star-outline' as const,
    color: '#F59E0B',
    highlight: false,
    features: ['Everything in Monthly', 'Save ₹30 per year', 'No monthly hassle', 'All modules included'],
  },
  {
    key: 'lifetime',
    title: 'Lifetime Plan',
    price: '₹1,500',
    period: 'one-time',
    desc: 'Pay once, use forever. Best value.',
    icon: 'infinite-outline' as const,
    color: Colors.success,
    highlight: true,
    features: ['Everything in Yearly', 'No recurring charges', 'Priority support', 'All future features included'],
  },
];

// Plan rank — higher = better. User can only subscribe to a plan strictly higher than current.
const PLAN_RANK: Record<string, number> = { monthly: 1, yearly: 2, lifetime: 3 };

export default function SubscribeScreen() {
  const { user, subscription, hasActiveSubscription, refreshSubscription } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'my-plan' | 'explore'>(hasActiveSubscription ? 'my-plan' : 'explore');
  const [loading, setLoading] = useState<string | null>(null);

  // Handle deep link return from Razorpay
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      if (!event.url.startsWith('mybuilding://subscription')) return;
      const params = new URLSearchParams(event.url.split('?')[1]);
      if (params.get('status') === 'success') {
        await refreshSubscription();
        setTab('my-plan');
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  const subscribe = async (plan: string) => {
    setLoading(plan);
    try {
      const orderRes = await api.post('/subscriptions/order', { plan });
      const { order_id, amount, key } = orderRes.data;
      const backendUrl = API_BASE.replace('/api', '');
      const checkoutUrl = `${backendUrl}/api/subscriptions/checkout/${order_id}?amount=${amount}&key=${key}&plan=${plan}&user_id=${user?.id}`;
      await WebBrowser.openBrowserAsync(checkoutUrl, {
        dismissButtonStyle: 'cancel',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
      await refreshSubscription();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setLoading(null);
    }
  };

  const isExpired = subscription?.status === 'expired';
  const isLifetime = subscription?.plan === 'lifetime';
  const isYearly = subscription?.plan === 'yearly';
  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null;
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const planLabel = isLifetime ? 'Lifetime Plan' : isYearly ? 'Yearly Plan' : 'Monthly Plan';
  const planPrice = isLifetime ? '₹1,500' : isYearly ? '₹150/yr' : '₹15/mo';
  const planIcon  = isLifetime ? 'infinite-outline' : isYearly ? 'star-outline' : 'calendar-outline';
  const planColor = isLifetime ? Colors.success : isYearly ? '#F59E0B' : Colors.primary;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Subscription</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, tab === 'my-plan' && s.tabActive]} onPress={() => setTab('my-plan')}>
          <Text style={[s.tabText, tab === 'my-plan' && s.tabTextActive]}>My Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'explore' && s.tabActive]} onPress={() => setTab('explore')}>
          <Text style={[s.tabText, tab === 'explore' && s.tabTextActive]}>Explore Plans</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── My Plan Tab ── */}
        {tab === 'my-plan' && (
          <>
            {hasActiveSubscription && subscription ? (
              <View style={s.activePlanCard}>
                <View style={s.activePlanTop}>
                  <View style={[s.planIconBox, { backgroundColor: planColor + '20' }]}>
                    <Ionicons name={planIcon as any} size={28} color={planColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.activePlanTitle}>{planLabel}</Text>
                    <View style={s.activeBadge}>
                      <View style={s.activeDot} />
                      <Text style={s.activeBadgeText}>Active</Text>
                    </View>
                  </View>
                  <Text style={s.activePlanPrice}>{planPrice}</Text>
                </View>

                <View style={s.divider} />

                {isLifetime ? (
                  <View style={s.infoRow}>
                    <Ionicons name="infinite" size={16} color={Colors.success} />
                    <Text style={s.infoText}>Never expires — you're set for life</Text>
                  </View>
                ) : (
                  <View style={s.infoRow}>
                    <Ionicons name="time-outline" size={16} color={daysLeft && daysLeft <= 5 ? Colors.danger : Colors.primary} />
                    <Text style={[s.infoText, daysLeft !== null && daysLeft <= 5 ? { color: Colors.danger } : undefined]}>
                      {daysLeft !== null && daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining` : 'Expires today'}
                    </Text>
                  </View>
                )}

                {expiresAt && (
                  <View style={s.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                    <Text style={s.infoText}>Renews on {expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                  </View>
                )}

                <View style={s.infoRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={s.infoText}>All modules unlocked</Text>
                </View>

                {!isLifetime && (
                  <TouchableOpacity style={s.upgradeBtn} onPress={() => setTab('explore')}>
                    <Ionicons name="arrow-up-circle-outline" size={18} color={Colors.success} />
                    <Text style={s.upgradeBtnText}>
                      {isYearly ? 'Upgrade to Lifetime' : 'Upgrade Plan'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={s.noSubCard}>
                <Ionicons name="lock-closed-outline" size={48} color={Colors.border} style={{ marginBottom: 12 }} />
                <Text style={s.noSubTitle}>{isExpired ? 'Subscription Expired' : 'No Active Subscription'}</Text>
                <Text style={s.noSubDesc}>
                  {isExpired
                    ? 'Your plan has expired. Renew to regain access to all modules.'
                    : 'Subscribe to unlock all features and modules.'}
                </Text>
                <TouchableOpacity style={s.exploreBtn} onPress={() => setTab('explore')}>
                  <Text style={s.exploreBtnText}>View Plans</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ── Explore Plans Tab ── */}
        {tab === 'explore' && (
          <>
            <Text style={s.exploreHeading}>Choose a Plan</Text>
            <Text style={s.exploreSubheading}>Unlock all features with a simple subscription</Text>

            {PLANS.map(plan => {
              const isCurrent = subscription?.plan === plan.key && hasActiveSubscription;
              const currentRank = hasActiveSubscription && subscription?.plan
                ? (PLAN_RANK[subscription.plan] ?? 0)
                : 0;
              const isLowerOrEqual = hasActiveSubscription && PLAN_RANK[plan.key] <= currentRank && !isCurrent;
              const isDisabled = !!loading || isLowerOrEqual;

              return (
                <View key={plan.key} style={[s.planCard, plan.highlight && s.planCardHighlight]}>
                  {plan.highlight && (
                    <View style={s.bestBadge}><Text style={s.bestBadgeText}>BEST VALUE</Text></View>
                  )}
                  <View style={s.planTop}>
                    <View style={[s.planIconBox, { backgroundColor: plan.color + '20' }]}>
                      <Ionicons name={plan.icon} size={26} color={plan.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.planTitle}>{plan.title}</Text>
                      <Text style={s.planDesc}>{plan.desc}</Text>
                    </View>
                    <View style={s.planPriceBox}>
                      <Text style={[s.planPrice, { color: plan.color }]}>{plan.price}</Text>
                      <Text style={s.planPeriod}>{plan.period}</Text>
                    </View>
                  </View>

                  <View style={s.featureList}>
                    {plan.features.map(f => (
                      <View key={f} style={s.featureRow}>
                        <Ionicons name="checkmark-circle" size={15} color={plan.color} />
                        <Text style={s.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>

                  {isCurrent ? (
                    <View style={[s.currentBtn, { borderColor: plan.color }]}>
                      <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                      <Text style={[s.currentBtnText, { color: plan.color }]}>Current Plan</Text>
                    </View>
                  ) : isLowerOrEqual ? (
                    <View style={s.disabledBtn}>
                      <Ionicons name="lock-closed-outline" size={15} color={Colors.textMuted} />
                      <Text style={s.disabledBtnText}>Not Available</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[s.subscribeBtn, { backgroundColor: plan.color }, isDisabled && s.subscribeBtnDisabled]}
                      onPress={() => subscribe(plan.key)}
                      disabled={isDisabled}
                    >
                      {loading === plan.key
                        ? <ActivityIndicator color={Colors.white} />
                        : <Text style={s.subscribeBtnText}>
                            {hasActiveSubscription ? `Upgrade — ${plan.price}` : `Subscribe — ${plan.price}`}
                          </Text>}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: '800' },
  scroll: { padding: 16 },

  // My Plan
  activePlanCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 4 },
  activePlanTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  planIconBox: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  activePlanTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  activeBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.success },
  activePlanPrice: { fontSize: 18, fontWeight: '800', color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoText: { fontSize: 14, color: Colors.text },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, borderWidth: 1.5, borderColor: Colors.success, borderRadius: 12, paddingVertical: 12 },
  upgradeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.success },
  noSubCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  noSubTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  noSubDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  exploreBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 },
  exploreBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },

  // Explore Plans
  exploreHeading: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  exploreSubheading: { fontSize: 14, color: Colors.textMuted, marginBottom: 20 },
  planCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, elevation: 4, borderWidth: 2, borderColor: 'transparent' },
  planCardHighlight: { borderColor: Colors.success },
  bestBadge: { backgroundColor: Colors.success, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 12 },
  bestBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  planTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  planDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  planPriceBox: { alignItems: 'flex-end' },
  planPrice: { fontSize: 20, fontWeight: '800' },
  planPeriod: { fontSize: 11, color: Colors.textMuted },
  featureList: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: Colors.text },
  subscribeBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  subscribeBtnDisabled: { opacity: 0.45 },
  subscribeBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  currentBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 13 },
  currentBtnText: { fontSize: 14, fontWeight: '700' },
  disabledBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingVertical: 13, backgroundColor: Colors.bg },
  disabledBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
});
