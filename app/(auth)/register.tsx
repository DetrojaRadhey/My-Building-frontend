import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import api from '../../utils/api';

// Shared validation helpers
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile: starts 6-9, exactly 10 digits

export const isValidEmail = (v: string) => EMAIL_RE.test(v.trim());
export const isValidPhone = (v: string) => PHONE_RE.test(v.trim());

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One digit', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function RegisterScreen() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const passwordStrength = PASSWORD_RULES.filter((r) => r.test(form.password)).length;
  const strengthColor = passwordStrength <= 2 ? Colors.danger : passwordStrength <= 3 ? Colors.warning : Colors.success;
  const strengthLabel = passwordStrength <= 2 ? 'Weak' : passwordStrength <= 3 ? 'Fair' : passwordStrength === 4 ? 'Good' : 'Strong';

  const handleRegister = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.password)
      return Alert.alert('Error', 'All fields are required');

    if (!isValidEmail(form.email))
      return Alert.alert('Invalid Email', 'Please enter a valid email address (e.g. user@example.com)');

    if (!isValidPhone(form.phone))
      return Alert.alert('Invalid Phone', 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9');

    const failedRule = PASSWORD_RULES.find((r) => !r.test(form.password));
    if (failedRule) return Alert.alert('Weak Password', failedRule.label);

    setLoading(true);
    try {
      await api.post('/auth/signup', form);
      Alert.alert('Success', 'Account created! You can now log in and join a building.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.logo}>🏢</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join your building community</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your full name"
            value={form.name}
            onChangeText={(v) => set('name', v)}
            autoCapitalize="words"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            value={form.email}
            onChangeText={(v) => set('email', v)}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="9876543210"
            value={form.phone}
            onChangeText={(v) => set('phone', v)}
            keyboardType="phone-pad"
            maxLength={10}
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              value={form.password}
              onChangeText={(v) => set('password', v)}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholderTextColor={Colors.textMuted}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {form.password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBar}>
                {PASSWORD_RULES.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.strengthSegment, { backgroundColor: i < passwordStrength ? strengthColor : Colors.border }]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strengthLabel}</Text>
            </View>
          )}

          {form.password.length > 0 && (
            <View style={styles.rulesList}>
              {PASSWORD_RULES.map((rule) => (
                <View key={rule.label} style={styles.ruleRow}>
                  <Ionicons
                    name={rule.test(form.password) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={rule.test(form.password) ? Colors.success : Colors.textMuted}
                  />
                  <Text style={[styles.ruleText, { color: rule.test(form.password) ? Colors.success : Colors.textMuted }]}>
                    {rule.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>

          <Text style={styles.note}>
            After registration, join a building and your pramukh will approve your account.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, padding: 24 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  header: { alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 48 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.white, marginTop: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  card: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, marginBottom: 16, backgroundColor: Colors.bg },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.bg, marginBottom: 10 },
  passwordInput: { flex: 1, padding: 12, fontSize: 15, color: Colors.text },
  eyeBtn: { paddingHorizontal: 12 },
  strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  strengthBar: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '700', width: 48, textAlign: 'right' },
  rulesList: { marginBottom: 16, gap: 5 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { fontSize: 12 },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  note: { marginTop: 16, fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
