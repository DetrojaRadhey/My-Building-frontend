import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LANGUAGES } from '../../constants/translations';
import { useRouter } from 'expo-router';
import api from '../../utils/api';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [buildingLogo, setBuildingLogo] = useState<string | null>(null);
  const isAdmin = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh';
  const hasBuilding = !!user?.building_id;

  useEffect(() => {
    if (user?.building_id) {
      api.get('/buildings/my')
        .then(res => setBuildingLogo(res.data.society_logo ?? null))
        .catch(() => {});
    }
  }, [user?.building_id]);

  const handleLogout = () => {
    Alert.alert(t('logout'), t('logoutConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: logout },
    ]);
  };

  const roleColor = isAdmin ? Colors.danger : isPramukh ? Colors.accent : Colors.success;
  const currentLang = LANGUAGES.find(l => l.code === language)!;

  const menuItems = isAdmin ? [] : [
    { icon: 'warning-outline', label: t('myComplaints'), onPress: () => router.push('/complaints?mine=true' as any), disabled: !hasBuilding },
    { icon: 'car-outline', label: t('myVehicles'), onPress: () => router.push('/my-vehicles' as any), disabled: !hasBuilding },
    { icon: 'wallet-outline', label: t('paymentHistory'), onPress: () => router.push('/my-payments' as any), disabled: !hasBuilding },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        {buildingLogo
          ? <Image source={{ uri: buildingLogo }} style={styles.avatarLargeImg} />
          : <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
            </View>
        }
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      {user?.building_id && isPramukh ? (
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Ionicons name="business" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{t('buildingId')}</Text>
              <Text style={styles.infoValueMono} selectable>{user.building_id}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {user?.role === 'user' && !user?.building_id ? (
        <View style={styles.section}>
          <View style={[styles.infoCard, { borderLeftWidth: 3, borderLeftColor: Colors.warning }]}>
            <Ionicons name="time-outline" size={20} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{t('buildingStatus')}</Text>
              <Text style={[styles.infoValue, { color: Colors.warning }]}>{t('notJoined')}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {menuItems.length > 0 && (
        <View style={styles.menuSection}>
          {menuItems.map((item, idx) => (
            item.disabled ? (
              <View
                key={item.label}
                style={[styles.menuItem, idx < menuItems.length - 1 && styles.menuItemBorder]}
              >
                <View style={styles.menuLeft}>
                  <Ionicons name={item.icon as any} size={22} color={Colors.textMuted} />
                  <View>
                    <Text style={[styles.menuLabel, { color: Colors.textMuted }]}>{item.label}</Text>
                    <Text style={styles.menuSub}>You need to join the building to access this feature</Text>
                  </View>
                </View>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
              </View>
            ) : (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, idx < menuItems.length - 1 && styles.menuItemBorder]}
                onPress={item.onPress}
              >
                <View style={styles.menuLeft}>
                  <Ionicons name={item.icon as any} size={22} color={Colors.primary} />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )
          ))}
        </View>
      )}

      {/* Language selector */}
      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem} onPress={() => setShowLangPicker(true)}>
          <View style={styles.menuLeft}>
            <Text style={styles.langFlag}>{currentLang.flag}</Text>
            <View>
              <Text style={styles.menuLabel}>{t('language')}</Text>
              <Text style={styles.menuSub}>{currentLang.nativeLabel}</Text>
            </View>
          </View>
          <View style={styles.langChip}>
            <Text style={styles.langChipText}>{currentLang.label}</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.logoutText}>{t('logout')}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      {/* Language picker modal */}
      <Modal visible={showLangPicker} transparent animationType="slide" onRequestClose={() => setShowLangPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowLangPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('selectLanguage')}</Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={i => i.code}
              renderItem={({ item }) => {
                const active = language === item.code;
                return (
                  <TouchableOpacity
                    style={[styles.langOption, active && styles.langOptionActive]}
                    onPress={() => { setLanguage(item.code); setShowLangPicker(false); }}
                  >
                    <Text style={styles.langOptionFlag}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.langOptionLabel, active && { color: Colors.primary }]}>{item.nativeLabel}</Text>
                      <Text style={styles.langOptionSub}>{item.label}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 32, alignItems: 'center' },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarLargeImg: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarText: { fontSize: 36, fontWeight: '800', color: Colors.white },
  name: { fontSize: 22, fontWeight: '800', color: Colors.white },
  email: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10 },
  roleText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  section: { margin: 16, marginBottom: 0 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: Colors.white, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  infoLabel: { fontSize: 12, color: Colors.textMuted },
  infoValue: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 2 },
  infoValueMono: { fontSize: 12, color: Colors.text, marginTop: 4, fontFamily: 'monospace' },
  menuSection: { margin: 16, marginBottom: 0, backgroundColor: Colors.white, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  menuSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  langFlag: { fontSize: 24 },
  langChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  langChipText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, marginTop: 16, backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: Colors.danger },
  logoutText: { fontSize: 16, fontWeight: '700', color: Colors.danger },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  langOption: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, marginBottom: 8, backgroundColor: Colors.bg },
  langOptionActive: { backgroundColor: Colors.primary + '12', borderWidth: 1.5, borderColor: Colors.primary },
  langOptionFlag: { fontSize: 28 },
  langOptionLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  langOptionSub: { fontSize: 13, color: Colors.textMuted, marginTop: 1 },
});
