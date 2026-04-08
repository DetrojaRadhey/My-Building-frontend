import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export default function TabsLayout() {
  const { user } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          borderTopWidth: 1.5,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />

      {/* Hidden from tab bar — navigated to from Home screen cards */}
      <Tabs.Screen name="maintenance"  options={{ href: null }} />
      <Tabs.Screen name="announcements" options={{ href: null }} />
      <Tabs.Screen name="parking"      options={{ href: null }} />
      <Tabs.Screen name="chat"         options={{ href: null }} />
      <Tabs.Screen name="visitors"     options={{ href: null }} />
      <Tabs.Screen name="admin"        options={{ href: null }} />
      <Tabs.Screen name="join"         options={{ href: null }} />
      <Tabs.Screen name="join-requests" options={{ href: null }} />
      <Tabs.Screen name="bank-details"  options={{ href: null }} />
      <Tabs.Screen name="users"         options={{ href: null }} />
      <Tabs.Screen name="members"       options={{ href: null }} />
      <Tabs.Screen name="expenses"      options={{ href: null }} />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
