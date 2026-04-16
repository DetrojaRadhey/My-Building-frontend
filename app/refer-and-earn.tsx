import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Share, TextInput, Modal,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

type Referral = {
  id: string;
  referrer_id: string;
  inquiry_id: string | null;
  referee_name: string;
  referee_email: string;
  society_name: string;
  reward_status: 'pending' | 'gift_card_added' | 'subscription_granted' | 'fully_rewarded';
  gift_card_code: string | null;
  gift_card_added_at: string | null;
  subscription_granted_at: string | null;
  created_at: string;
  referrer?: { name: string; email: string };
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:              { label: 'Pending',          color: '#92400E', bg: '#FEF3C7' },
  gift_card_added:      { label: 'Gift Card Added',  color: '#065F46', bg: '#D1FAE5' },
  subscription_granted: { label: 'Sub Granted',      color: '#1E40AF', bg: '#DBEAFE' },
  fully_rewarded:       { label: 'Fully Rewarded',   color: '#5B21B6', bg: '#EDE9FE' },
};

export default function ReferAndEarnScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [giftCardModal, setGiftCardModal] = useState<{ visible: boolean; referralId: string }>({ visible: false, referralId: '' });
  const [giftCardInput, setGiftCardInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      if (isAdmin) {
        const res = await api.get('/refer/admin/all');
        setReferrals(res.data);
      } else {
        const [codeRes, referralsRes] = await Promise.all([
          api.get('/refer/my-code'),
          api.get('/refer/my-referrals'),
        ]);
        setReferralCode(codeRes.data.referral_code);
        setReferrals(referralsRes.data);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const copyCode = () => {
    if (!referralCode) return;
    Clipboard.setString(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard.');
  };

  const shareCode = () => {
    if (!referralCode) return;
    Share.share({
      message: `Join My Building app! Use my referral code ${referralCode} when registering your society to earn rewards.`,
    });
  };

  const grantSubscription = async (referralId: string) => {
    Alert.alert('Grant Subscription', 'Grant 1 year subscription to this referrer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Grant', onPress: async () => {
          try {
            await api.post('/refer/admin/grant-subscription', { referral_id: referralId });
            fetchData();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Failed');
          }
        },
      },
    ]);
  };

  const openGiftCardModal = (referralId: string) => {
    setGiftCardInput('');
    setGiftCardModal({ visible: true, referralId });
  };

  const submitGiftCard = async () => {
    if (!giftCardInput.trim()) return Alert.alert('Error', 'Enter a gift card code');
    setSubmitting(true);
    try {
      await api.post('/refer/admin/add-gift-card', {
        referral_id: giftCardModal.referralId,
        gift_card_code: giftCardInput.trim(),
      });
      setGiftCardModal({ visible: false, referralId: '' });
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReferrals = search.trim()
    ? referrals.filter(r => r.society_name?.toLowerCase().includes(search.toLowerCase()))
    : referrals;

  const renderStatusBadge = (status: string) => {
    const s = STATUS_LABELS[status] || STATUS_LABELS.pending;
    return (
      <View style={[styles.badge, { backgroundColor: s.bg }]}>
        <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
      </View>
    );
  };

  const renderUserItem = ({ item }: { item: Referral }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardSociety}>{item.society_name}</Text>
          <Text style={styles.cardMeta}>{item.referee_name} · {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>
        {renderStatusBadge(item.reward_status)}
      </View>

      {item.gift_card_code && (
        <View style={styles.giftCardBox}>
          <Ionicons name="gift-outline" size={16} color="#065F46" />
          <Text style={styles.giftCardLabel}>Gift Card Code:</Text>
          <Text style={styles.giftCardCode}>{item.gift_card_code}</Text>
        </View>
      )}

      {item.subscription_granted_at && (
        <View style={styles.subGrantedRow}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
          <Text style={styles.subGrantedText}>1 year subscription added ✓</Text>
        </View>
      )}
    </View>
  );

  const renderAdminItem = ({ item }: { item: Referral }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardSociety}>{item.society_name}</Text>
          <Text style={styles.cardMeta}>
            Referrer: {item.referrer?.name ?? '—'} ({item.referrer?.email ?? '—'})
          </Text>
          <Text style={styles.cardMeta}>
            Referee: {item.referee_name} · {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        {renderStatusBadge(item.reward_status)}
      </View>

      <View style={styles.adminActions}>
        <TouchableOpacity
          style={[styles.actionBtn, !!item.subscription_granted_at && styles.actionBtnDisabled]}
          onPress={() => !item.subscription_granted_at && grantSubscription(item.id)}
          disabled={!!item.subscription_granted_at}
        >
          <Ionicons name="card-outline" size={14} color={item.subscription_granted_at ? Colors.textMuted : Colors.primary} />
          <Text style={[styles.actionBtnText, !!item.subscription_granted_at && { color: Colors.textMuted }]}>
            {item.subscription_granted_at ? 'Sub Granted ✓' : 'Grant 1 Year Sub'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, !!item.gift_card_added_at && styles.actionBtnDisabled]}
          onPress={() => !item.gift_card_added_at && openGiftCardModal(item.id)}
          disabled={!!item.gift_card_added_at}
        >
          <Ionicons name="gift-outline" size={14} color={item.gift_card_added_at ? Colors.textMuted : '#EC4899'} />
          <Text style={[styles.actionBtnText, !!item.gift_card_added_at && { color: Colors.textMuted }, !item.gift_card_added_at && { color: '#EC4899' }]}>
            {item.gift_card_added_at ? 'Gift Card Added ✓' : 'Add Gift Card'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isAdmin ? 'Refer & Earn — Admin' : 'Refer & Earn'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={filteredReferrals}
          keyExtractor={i => i.id}
          renderItem={isAdmin ? renderAdminItem : renderUserItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
          ListHeaderComponent={
            <>
              {/* User/Pramukh: referral code card */}
              {!isAdmin && referralCode && (
                <View style={styles.codeCard}>
                  <Text style={styles.codeLabel}>Your Referral Code</Text>
                  <Text style={styles.codeValue}>{referralCode}</Text>
                  <View style={styles.codeActions}>
                    <TouchableOpacity style={styles.codeBtn} onPress={copyCode}>
                      <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                      <Text style={styles.codeBtnText}>Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.codeBtn, styles.codeBtnShare]} onPress={shareCode}>
                      <Ionicons name="share-outline" size={18} color={Colors.white} />
                      <Text style={[styles.codeBtnText, { color: Colors.white }]}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* User/Pramukh: rewards info */}
              {!isAdmin && (
                <View style={styles.rewardsCard}>
                  <Text style={styles.rewardsTitle}>How it works</Text>
                  <View style={styles.rewardRow}>
                    <View style={[styles.rewardIcon, { backgroundColor: '#FFF0F5' }]}>
                      <Ionicons name="gift-outline" size={20} color="#EC4899" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rewardName}>₹1,000 Gift Card</Text>
                      <Text style={styles.rewardDesc}>Amazon or Flipkart voucher added by admin</Text>
                    </View>
                  </View>
                  <View style={styles.rewardRow}>
                    <View style={[styles.rewardIcon, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="card-outline" size={20} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rewardName}>1 Year Free Subscription</Text>
                      <Text style={styles.rewardDesc}>Your subscription extended by 1 year</Text>
                    </View>
                  </View>
                  <Text style={styles.rewardsHint}>
                    Share your code when someone registers a new society via the app.
                  </Text>
                </View>
              )}

              {/* Admin: search */}
              {isAdmin && (
                <View style={styles.searchBar}>
                  <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Filter by society name..."
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
              )}

              {filteredReferrals.length > 0 && (
                <Text style={styles.sectionTitle}>
                  {isAdmin ? `All Referrals (${filteredReferrals.length})` : 'My Referrals'}
                </Text>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="gift-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyTitle}>No referrals yet</Text>
              <Text style={styles.emptyText}>
                {isAdmin
                  ? 'No referrals have been submitted yet.'
                  : 'Share your code and earn rewards when someone registers a society.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Gift Card Modal */}
      <Modal visible={giftCardModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Gift Card Code</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter gift card code"
              placeholderTextColor={Colors.textMuted}
              value={giftCardInput}
              onChangeText={setGiftCardInput}
              autoCapitalize="characters"
              maxLength={64}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setGiftCardModal({ visible: false, referralId: '' })}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={submitGiftCard} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.modalSubmitText}>Add</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },

  list: { padding: 16, paddingBottom: 40 },

  // Code card
  codeCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  codeLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', marginBottom: 8 },
  codeValue: { fontSize: 32, fontWeight: '900', color: '#3B5FC0', letterSpacing: 6, marginBottom: 16 },
  codeActions: { flexDirection: 'row', gap: 12 },
  codeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  codeBtnShare: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  codeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  // Rewards card
  rewardsCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  rewardsTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rewardIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  rewardName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  rewardDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  rewardsHint: { fontSize: 12, color: Colors.textMuted, marginTop: 8, lineHeight: 18 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textMuted, marginBottom: 8 },

  // Referral card
  card: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  cardSociety: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  giftCardBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#D1FAE5', borderRadius: 8, padding: 8, marginTop: 4,
  },
  giftCardLabel: { fontSize: 12, fontWeight: '600', color: '#065F46' },
  giftCardCode: { fontSize: 13, fontWeight: '800', color: '#065F46', letterSpacing: 1 },

  subGrantedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  subGrantedText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  // Admin actions
  adminActions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  actionBtnDisabled: { borderColor: Colors.border },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Empty
  empty: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  // Gift card modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 14 },
  modalInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    padding: 12, fontSize: 15, color: Colors.text, marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  modalSubmitBtn: { flex: 1, backgroundColor: '#EC4899', borderRadius: 10, padding: 12, alignItems: 'center' },
  modalSubmitText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
