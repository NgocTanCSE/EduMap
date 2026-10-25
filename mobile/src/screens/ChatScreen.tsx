import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { apiService } from '../services/api';
import { aiService } from '../services/ai.service';
import { Send, Clock, Trash2 } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'Chat'>;

type ChatMessage = { role: 'user' | 'assistant'; content: string; isError?: boolean; isStreaming?: boolean };

export const ChatScreen: React.FC<Props> = ({ navigation }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-generate / restore session ID on first mount.
  // The session ID ties the chat to SessionMemoryService on the backend,
  // enabling short-term memory + query-relevant context across turns.
  useEffect(() => {
    aiService.getSessionId();
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    // Add an empty assistant "bubble" that gets filled word-by-word
    // (the typing/streaming effect). isStreaming=true so the UI shows a
    // cursor indicator instead of a spinner.
    setMessages((prev) => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    // Build history from all prior complete messages (exclude the empty
    // assistant bubble we just added).
    const history = messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    let accumulated = '';
    const appendToken = (token: string) => {
      accumulated += token;
      setMessages((prev) => {
        const newMsgs = [...prev];
        if (newMsgs.length > 0) {
          newMsgs[newMsgs.length - 1] = {
            ...newMsgs[newMsgs.length - 1],
            content: accumulated,
          };
        }
        return newMsgs;
      });
      // Scroll to bottom as tokens arrive for a smooth typing effect
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 30);
    };

    try {
      // Use SSE streaming via the backend's /ai/chat-stream endpoint.
      // The backend proxies to ai-service /api/ai/chat/stream which yields
      // word-by-word SSE chunks. This gives the mobile UI a real-time
      // "chữ chạy" (typing) effect.
      let gotAnyToken = false;
      const stream = aiService.sendMessageStream(userMsg, history, 'mobile', (tok) => {
        gotAnyToken = true;
        appendToken(tok);
      });

      for await (const token of stream) {
        // The async generator yields each token; the onToken callback
        // already updates the UI. This loop just keeps the stream going.
        if (token) gotAnyToken = true;
      }

      if (!gotAnyToken || accumulated.length === 0) {
        throw new Error('Stream produced no output.');
      }

      // Mark the streaming message as complete
      setMessages((prev) => {
        const newMsgs = [...prev];
        if (newMsgs.length > 0) {
          newMsgs[newMsgs.length - 1] = {
            ...newMsgs[newMsgs.length - 1],
            isStreaming: false,
          };
        }
        return newMsgs;
      });
    } catch {
      // The sendMessageStream already has its own non-streaming fallback,
      // but if that also failed, show an error message.
      setMessages((prev) => {
        const newMsgs = [...prev];
        if (newMsgs.length > 0) {
          newMsgs[newMsgs.length - 1] = {
            ...newMsgs[newMsgs.length - 1],
            content: accumulated.length > 0
              ? accumulated
              : 'Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra kết nối mạng.',
            isError: accumulated.length === 0,
            isStreaming: false,
          };
        }
        return newMsgs;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    aiService.reset();
    setMessages([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Trợ lý EduMap</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={handleClearChat} disabled={messages.length === 0}>
            <Trash2 size={20} color={messages.length === 0 ? Colors.textMuted : '#ef4444'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ChatHistory')}>
            <Clock size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollViewRef} style={{ flex: 1, marginBottom: 10 }} showsVerticalScrollIndicator={false}>
          {messages.length === 0 && (
            <Text style={styles.hint}>Hãy hỏi AI về học bổng, trường học, ngành nghề hay kiến thức chung...</Text>
          )}
          {messages.map((msg, index) => (
            <View
              key={index}
              style={[
                styles.chatBubble,
                msg.role === 'user'
                  ? styles.userBubble
                  : msg.isError
                  ? styles.errorBubble
                  : msg.isStreaming
                  ? [styles.aiBubble, { opacity: 0.7 }]
                  : styles.aiBubble,
              ]}
            >
              <Text style={[styles.chatText, msg.isError && { color: '#fca5a5' }]}>{msg.content}</Text>
            </View>
          ))}
          {loading && !messages.some((m) => m.isStreaming) && (
            <View style={[styles.chatBubble, styles.aiBubble, { width: 60 }]}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          )}
        </ScrollView>

        <View style={styles.chatInputContainer}>
          <TextInput
            style={styles.chatInput}
            placeholder="Nhập câu hỏi..."
            placeholderTextColor={Colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSendMessage}
            editable={!loading}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage} disabled={loading || !input.trim()}>
            <Send size={20} color={Colors.background} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.sm, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
  headerTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  hint: { color: Colors.textMuted, textAlign: 'center', marginTop: 50, fontSize: FontSize.sm },
  chatBubble: { padding: 15, borderRadius: 20, marginBottom: 10, maxWidth: '85%' },
  userBubble: { backgroundColor: Colors.card, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  errorBubble: { backgroundColor: '#450a0a', borderWidth: 1, borderColor: '#7f1d1d', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  chatText: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  chatInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  chatInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: FontSize.base,
  },
  sendButton: { backgroundColor: Colors.primary, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

export default ChatScreen;
