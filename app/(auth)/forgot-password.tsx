import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import api from '../../utils/api';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One digit', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordStrength = PASSWORD_RULES.filter((r) => r.test(newPassword)).length;
  const strengthColor = passwordStrength <= 2 ? Colors.danger : passwordStrength <= 3 ? Colors.warning : Colors.success;
  const strengthLabel = passwordStrength <= 2 ? 'Weak' : passwordStrength <= 3 ? 'Fair' : passwordStrength === 4 ? 'Good' : 'Strong';

  const sendOtp = async () => {
    if (!email.trim()) return Alert.alert('Error', 'Please enter your email');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      Alert.alert('OTP Sent', `A 6-digit OTP has been sent to ${email.trim()}`);
      setStep('otp');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) return Alert.alert('Error', 'Please enter the 6-digit OTP');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email: email.trim(), otp: otp.trim() });
      setResetToken(res.data.reset_token);
      setStep('password');
    } catch (e: any) {
      Alert.alert('Invalid OTP', e.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    const failedRule = PASSWORD_RULES.find((r) => !r.test(newPassword));
    if (failedRule) return Alert.alert('Weak Password', failedRule.label);
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { reset_token: resetToken, new_password: newPassword });
      Alert.alert('Success', 'Password reset successfully! Please log in with your new password.', [
        { text: 'Login', onPress: () => router.replace('/login' as any) },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = step === 'email' ? 0 : step === 'otp' ? 1 : 2;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.logo}>🔐</Text>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>We'll send an OTP to your email</Text>
        </View>

        {/* Step indicator */}
        <View style={styles.steps}>
          {['Email', 'OTP', 'New Password'].map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]}>
                {i < stepIndex
                  ? <Ionicons name="checkmark" size={14} color={Colors.white} />
                  : <Text style={[styles.stepNum, i <= stepIndex && styles.stepNumActive]}>{i + 1}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, i <= stepIndex && styles.stepLabelActive]}>{s}</Text>
              {i < 2 && <View style={[styles.stepLine, i < stepIndex && styles.stepLineActive]} />}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          {/* Step 1: Email */}
          {step === 'email' && (
            <>
              <Text style={styles.cardTitle}>Enter your email</Text>
              <Text style={styles.cardSub}>We'll send a 6-digit OTP to reset your password</Text>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity style={styles.btn} onPress={sendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <>
              <Text style={styles.cardTitle}>Enter OTP</Text>
              <Text style={styles.cardSub}>Check your email {email} for the 6-digit code</Text>
              <Text style={styles.label}>6-Digit OTP</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="000000"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholderTextColor={Colors.textMuted}
              />
              <TouchableOpacity style={styles.btn} onPress={verifyOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify OTP</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep('email'); setOtp(''); }}>
                <Text style={styles.resendText}>Didn't receive it? Go back and resend</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Step 3: New Password */}
          {step === 'password' && (
            <>
              <Text style={styles.cardTitle}>Set New Password</Text>
              <Text style={styles.cardSub}>Choose a strong password for your account</Text>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBar}>
                    {PASSWORD_RULES.map((_, i) => (
                      <View key={i} style={[styles.strengthSegment, { backgroundColor: i < passwordStrength ? strengthColor : Colors.border }]} />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strengthLabel}</Text>
                </View>
              )}

              {newPassword.length > 0 && (
                <View style={styles.rulesList}>
                  {PASSWORD_RULES.map((rule) => (
                    <View key={rule.label} style={styles.ruleRow}>
                      <Ionicons name={rule.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={rule.test(newPassword) ? Colors.success : Colors.textMuted} />
                      <Text style={[styles.ruleText, { color: rule.test(newPassword) ? Colors.success : Colors.textMuted }]}>{rule.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.btn} onPress={resetPassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset Password</Text>}
              </TouchableOpacity>
            </>
          )}
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
  header: { alignItems: 'center', marginBottom: 24 },
  logo: { fontSize: 48 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.white, marginTop: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: Colors.white },
  stepNum: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  stepNumActive: { color: Colors.primary },
  stepLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 4, marginRight: 4 },
  stepLabelActive: { color: Colors.white, fontWeight: '700' },
  stepLine: { width: 24, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.white },
  card: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: 13, color: Colors.textMuted, marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, marginBottom: 16, backgroundColor: Colors.bg },
  otpInput: { fontSize: 24, fontWeight: '800', letterSpacing: 8, textAlign: 'center' },
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
  btn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  resendBtn: { marginTop: 14, alignItems: 'center' },
  resendText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
