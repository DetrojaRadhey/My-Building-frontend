import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '../constants/colors';
import NoInternetOverlay from '../components/NoInternetOverlay';

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = (segments[0] as string) === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login' as any);
    else if (user && inAuth) router.replace('/' as any);
  }, [user, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="subscribe" />
      <Stack.Screen name="subscriptions-admin" />
      <Stack.Screen name="helpline" />
      <Stack.Screen name="complaints" />
      <Stack.Screen name="complaints-admin" />
      <Stack.Screen name="activity-logs" />
      <Stack.Screen name="entry/[building_id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RootNavigator />
        <NoInternetOverlay />
      </AuthProvider>
    </LanguageProvider>
  );
}
