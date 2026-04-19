import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { CacheProvider } from '../context/CacheContext';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '../constants/colors';
import NoInternetOverlay from '../components/NoInternetOverlay';
import { OfflineIndicator } from '../components/OfflineIndicator';

function RootNavigator() {
  const { user, loading: authLoading } = useAuth();
  const { hasChosen, loading: langLoading, initForUser } = useLanguage();
  const segments = useSegments();
  const router = useRouter();
  const initializedRef = useRef<string | null>(null);

  // When auth resolves, init language for the current user (or unblock if no user)
  useEffect(() => {
    if (authLoading) return;

    if (user?.id) {
      // Only call initForUser once per user session to avoid re-triggering
      if (initializedRef.current !== user.id) {
        initializedRef.current = user.id;
        initForUser(user.id);
      }
    } else {
      // No user logged in — unblock language loading immediately
      if (initializedRef.current !== 'no-user') {
        initializedRef.current = 'no-user';
        // Access the internal markNoUser via a workaround — just set loading done
        // by calling initForUser with a dummy that won't find a key
        initForUser('__no_user__');
      }
    }
  }, [authLoading, user?.id]);

  // Routing logic — only runs once both auth and language are resolved
  useEffect(() => {
    if (authLoading || langLoading) return;

    const inAuth = (segments[0] as string) === '(auth)';
    const inLangPicker = (segments[0] as string) === 'choose-language';

    if (!user) {
      if (!inAuth) router.replace('/(auth)/login' as any);
      return;
    }

    // Logged in but hasn't chosen language yet → show picker
    if (!hasChosen) {
      if (!inLangPicker) router.replace('/choose-language' as any);
      return;
    }

    // Logged in + language chosen → go home
    if (inAuth || inLangPicker) router.replace('/' as any);
  }, [user, authLoading, hasChosen, langLoading]);

  if (authLoading || langLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right' }}>
      <Stack.Screen name="choose-language" options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="maintenance" />
      <Stack.Screen name="announcements" />
      <Stack.Screen name="visitors" />
      <Stack.Screen name="parking" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="members" />
      <Stack.Screen name="expenses" />
      <Stack.Screen name="join-requests" />
      <Stack.Screen name="subscribe" />
      <Stack.Screen name="subscriptions-admin" />
      <Stack.Screen name="helpline" />
      <Stack.Screen name="complaints" />
      <Stack.Screen name="complaints-admin" />
      <Stack.Screen name="activity-logs" />
      <Stack.Screen name="website-contacts" />
      <Stack.Screen name="cache-debug" />
      <Stack.Screen name="entry/[building_id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <CacheProvider>
      <LanguageProvider>
        <AuthProvider>
          <OfflineIndicator />
          <RootNavigator />
          <NoInternetOverlay />
        </AuthProvider>
      </LanguageProvider>
    </CacheProvider>
  );
}
