import React, { useEffect, useRef } from 'react';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function NoInternetOverlay() {
  const { isConnected, isChecking } = useNetworkStatus();
  const [retrying, setRetrying] = React.useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation on the wifi icon
  useEffect(() => {
    if (!isConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isConnected]);

  const retry = async () => {
    setRetrying(true);
    await NetInfo.fetch();
    // Give it a moment to update state
    setTimeout(() => setRetrying(false), 1500);
  };

  // Don't render anything while doing initial check or when connected
  if (isChecking || isConnected) return null;

  

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Animated.View style={[styles.iconBox, { opacity: pulseAnim }]}>
            <Ionicons name="wifi-outline" size={52} color={Colors.danger} />
          </Animated.View>

          <Text style={styles.title}>No Internet Connection</Text>
          <Text style={styles.subtitle}>
            Please check your Wi-Fi or mobile data and try again.
          </Text>

          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.tip}>Make sure Wi-Fi or mobile data is turned on</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.tip}>Move to an area with better signal</Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.tip}>Try turning Airplane mode on and off</Text>
          </View>

          <TouchableOpacity
            style={[styles.retryBtn, retrying && { opacity: 0.7 }]}
            onPress={retry}
            disabled={retrying}
            activeOpacity={0.85}
          >
            {retrying ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color={Colors.white} />
                <Text style={styles.retryText}>Try Again</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.danger + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  tip: {
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 20,
    width: '100%',
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
