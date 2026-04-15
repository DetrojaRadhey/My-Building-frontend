import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../constants/colors';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useActivityLog } from '../hooks/useActivityLog';

export default function ChatScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { logEvent } = useActivityLog();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [noBuildingError, setNoBuildingError] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const lastMsgIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFocusedRef = useRef(false);

  const scrollToBottom = (animated = true) =>
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 80);

  const mergeMessages = (prev: any[], incoming: any[]) => {
    const ids = new Set(prev.map((m) => m.id));
    const fresh = incoming.filter((m) => !ids.has(m.id));
    if (!fresh.length) return prev;
    return [...prev, ...fresh].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  };

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

  // Poll for new messages every 4 seconds
  const pollNewMessages = useCallback(async () => {
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

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      if (isFocusedRef.current) pollNewMessages();
    }, 4000);
  }, [pollNewMessages]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      logEvent('open_chat', 'chat');
      fetchMessages().then(() => startPolling());
      return () => {
        isFocusedRef.current = false;
        stopPolling();
      };
    }, [fetchMessages, startPolling, stopPolling])
  );

  useEffect(() => {
    if (messages.length > 0) scrollToBottom(false);
  }, [loading]);

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      const res = await api.post('/chat', { message: trimmed });
      const sent = res.data;
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        lastMsgIdRef.current = sent.id;
        return [...prev, sent];
      });
      scrollToBottom();
    } catch {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <View style={styles.groupIcon}>
            <Text style={{ fontSize: 20 }}>🏢</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Building Chat</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.headerSub}>Group · All members</Text>
            </View>
          </View>
        </View>
      </View>

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
              <Text style={styles.empty}>{t('beFirstToSay')}</Text>
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
          placeholder={noBuildingError ? 'Not available for admin' : t('typeMessage')}
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
  header: { backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  groupIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 18, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
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
