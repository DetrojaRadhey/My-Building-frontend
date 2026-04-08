import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Colors } from '../../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { supabase } from '../../utils/supabase';
import { useActivityLog } from '../../hooks/useActivityLog';

type ConnStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export default function ChatScreen() {
  const { user } = useAuth();
  const { logEvent } = useActivityLog();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [noBuildingError, setNoBuildingError] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting');

  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Track the id of the last message we received for gap-fill
  const lastMsgIdRef = useRef<string | null>(null);
  // Reconnect timer
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFocusedRef = useRef(false);

  const scrollToBottom = (animated = true) =>
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 80);

  // ── Merge new messages deduplicating by id ────────────────────────────────
  const mergeMessages = (prev: any[], incoming: any[]) => {
    const ids = new Set(prev.map((m) => m.id));
    const fresh = incoming.filter((m) => !ids.has(m.id));
    if (!fresh.length) return prev;
    return [...prev, ...fresh].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  };

  // ── Initial load ──────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get('/chat');
      const msgs: any[] = res.data;
      setMessages(msgs);
      if (msgs.length) lastMsgIdRef.current = msgs[msgs.length - 1].id;
      setNoBuildingError(false);
    } catch (e: any) {
      if (e.response?.data?.error?.includes('building')) setNoBuildingError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Gap-fill: fetch any messages we missed while disconnected ─────────────
  const fillGap = useCallback(async () => {
    if (!lastMsgIdRef.current) return;
    try {
      const res = await api.get(`/chat/new?after_id=${lastMsgIdRef.current}`);
      const fresh: any[] = res.data;
      if (fresh.length) {
        setMessages((prev) => {
          const merged = mergeMessages(prev, fresh);
          if (merged.length > prev.length) {
            lastMsgIdRef.current = merged[merged.length - 1].id;
            scrollToBottom();
          }
          return merged;
        });
      }
    } catch {}
  }, []);

  // ── Realtime subscription ─────────────────────────────────────────────────
  const subscribe = useCallback(() => {
    if (!user?.building_id) return;

    // Tear down any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setConnStatus('connecting');

    channelRef.current = supabase
      .channel(`chats:${user.building_id}`, {
        config: { broadcast: { ack: false }, presence: { key: '' } },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chats',
          filter: `building_id=eq.${user.building_id}`,
        },
        (payload) => {
          const msg = payload.new as any;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            const updated = [...prev, msg];
            lastMsgIdRef.current = msg.id;
            return updated;
          });
          scrollToBottom();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setConnStatus('live');
          // Fill any gap that occurred while we were reconnecting
          fillGap();
          // Clear any pending reconnect timer
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnStatus('reconnecting');
          // Auto-reconnect after 3 seconds
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (isFocusedRef.current) subscribe();
          }, 3000);
        } else if (status === 'CLOSED') {
          setConnStatus('offline');
        }
      });
  }, [user?.building_id, fillGap]);

  const unsubscribe = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setConnStatus('offline');
  }, []);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      logEvent('open_chat', 'chat');
      fetchMessages().then(() => subscribe());
      return () => {
        isFocusedRef.current = false;
        unsubscribe();
      };
    }, [fetchMessages, subscribe, unsubscribe])
  );

  useEffect(() => {
    if (messages.length > 0) scrollToBottom(false);
  }, [loading]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      const res = await api.post('/chat', { message: trimmed });
      const sent = res.data;
      // Optimistic add — Realtime will also fire but dedup handles it
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        lastMsgIdRef.current = sent.id;
        return [...prev, sent];
      });
      scrollToBottom();
    } catch {
      setText(trimmed); // restore on failure
    } finally {
      setSending(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isMe = item.user_id === user?.id;
    const prevItem = messages[index - 1];
    const showName = !isMe && (!prevItem || prevItem.user_id !== item.user_id);
    const time = new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const msgDate = new Date(item.created_at).toDateString();
    const prevDate = prevItem ? new Date(prevItem.created_at).toDateString() : null;
    const showDateSep = msgDate !== prevDate;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const dateLabel =
      msgDate === today ? 'Today'
      : msgDate === yesterday ? 'Yesterday'
      : new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
      <>
        {showDateSep && (
          <View style={styles.dateSepRow}>
            <View style={styles.dateSepLine} />
            <Text style={styles.dateSepText}>{dateLabel}</Text>
            <View style={styles.dateSepLine} />
          </View>
        )}
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          {!isMe && (
            <View style={styles.msgAvatar}>
              <Text style={styles.msgAvatarText}>{item.sender_name?.[0]?.toUpperCase()}</Text>
            </View>
          )}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
            {showName && <Text style={styles.senderName}>{item.sender_name}</Text>}
            <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.message}</Text>
            <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{time}</Text>
          </View>
        </View>
      </>
    );
  };

  const statusDot = {
    live:         { color: '#22C55E', label: 'Live' },
    connecting:   { color: Colors.accent, label: 'Connecting...' },
    reconnecting: { color: Colors.warning, label: 'Reconnecting...' },
    offline:      { color: Colors.danger, label: 'Offline' },
  }[connStatus];

  

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.groupIcon}>
            <Text style={{ fontSize: 20 }}>🏢</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Building Chat</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusDot.color }]} />
              <Text style={styles.headerSub}>
                {connStatus === 'live' ? 'Group · All members' : statusDot.label}
              </Text>
            </View>
          </View>
        </View>
        {/* Manual refresh only shown when offline */}
        {connStatus === 'offline' && (
          <TouchableOpacity onPress={() => subscribe()} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {/* Reconnecting banner */}
      {connStatus === 'reconnecting' && (
        <View style={styles.reconnectBanner}>
          <ActivityIndicator size="small" color={Colors.warning} />
          <Text style={styles.reconnectText}>Connection lost — reconnecting...</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : noBuildingError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏢</Text>
          <Text style={styles.empty}>Admin is not assigned to a building.{'\n'}Chat is per-building only.</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(i) => i.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          onContentSizeChange={() => scrollToBottom(false)}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.empty}>No messages yet. Say hello!</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={noBuildingError ? 'Not available for admin' : 'Type a message...'}
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={500}
          editable={!noBuildingError}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Ionicons name="send" size={20} color={Colors.white} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECE5DD' },
  header: { backgroundColor: Colors.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 18, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  refreshBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  reconnectBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warning + '20', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.warning + '40' },
  reconnectText: { fontSize: 13, color: Colors.warning, fontWeight: '600' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4, gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  msgAvatarText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  bubble: { maxWidth: '75%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  bubbleMe: { backgroundColor: '#DCF8C6', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: Colors.white, borderBottomLeftRadius: 4 },
  senderName: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  msgText: { fontSize: 15, color: Colors.text, lineHeight: 20 },
  msgTextMe: { color: '#111' },
  msgTime: { fontSize: 11, color: Colors.textMuted, marginTop: 4, textAlign: 'right' },
  msgTimeMe: { color: '#6B7280' },
  dateSepRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 8 },
  dateSepLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  dateSepText: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginHorizontal: 10, backgroundColor: '#ECE5DD', paddingHorizontal: 6 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  empty: { textAlign: 'center', color: Colors.textMuted, fontSize: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: Colors.text, maxHeight: 100, backgroundColor: Colors.bg },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },
});
