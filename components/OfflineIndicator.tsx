import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCache } from '../context/CacheContext';

export function OfflineIndicator() {
  const { isOnline } = useCache();
  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>No internet connection — showing cached data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#F59E0B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
