import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';
  const isPramukh = user?.role === 'pramukh';

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const roleColor = isAdmin ? Colors.danger : isPramukh ? Colors.accent : Colors.success;

  const menuItems = isAdmin ? [] : [
    { icon: 'car-outline', label: 'My Vehicles', onPress: () => router.push('/my-vehicles' as any) },
    { icon: 'alert-circle-outline', label: 'My Complaints', onPress: () => router.push('/my-complaints' as any) },
    { icon: 'wallet-outline', label: 'Payment History', onPress: () => router.push('/my-payments' as any) },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      {/* Building ID for pramukh */}
      {user?.building_id && isPramukh ? (
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Ionicons name="business" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Building ID — share with residents</Text>
              <Text style={styles.infoValueMono} selectable>{user.building_id}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Not joined warning for user */}
      {user?.role === 'user' && !user?.building_id ? (
        <View style={styles.infoSection}>
          <View style={[styles.infoCard, { borderLeftWidth: 3, borderLeftColor: Colors.warning }]}>
            <Ionicons name="time-outline" size={20} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Building Status</Text>
              <Text style={[styles.infoValue, { color: Colors.warning }]}>Not joined any building yet</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Quick Links (non-admin only) */}
      {menuItems.length > 0 ? (
        <View style={styles.menuSection}>
          {menuItems.map((item, idx) => (
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
          ))}
        </View>
      ) : null}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 32, alignItems: 'center' },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 36, fontWeight: '800', color: Colors.white },
  name: { fontSize: 22, fontWeight: '800', color: Colors.white },
  email: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10 },
  roleText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  infoSection: { margin: 16, marginBottom: 0, gap: 10 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: Colors.white, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  infoLabel: { fontSize: 12, color: Colors.textMuted },
  infoValue: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 2 },
  infoValueMono: { fontSize: 12, color: Colors.text, marginTop: 4, fontFamily: 'monospace' },
  menuSection: { margin: 16, backgroundColor: Colors.white, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: Colors.danger },
  logoutText: { fontSize: 16, fontWeight: '700', color: Colors.danger },
});
