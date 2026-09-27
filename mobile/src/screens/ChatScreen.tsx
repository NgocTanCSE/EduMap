import React, { useState } from 'react';
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
import { Send, Clock } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'Chat'>;

type ChatMessage = { role: 'user' | 'assistant'; content: string; isError?: boolean };

export const ChatScreen: React.FC<Props> = ({ navigation }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await apiService.sendChatMessage(userMsg, history);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.reply || response.message || 'Xin lỗi, mình gặp chút trục trặc.',
          isError: !!response.error,
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Không thể kết nối đến máy chủ AI (Timeout 10s). Vui lòng kiểm tra kết nối mạng.',
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Trợ lý EduMap</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ChatHistory')}>
          <Clock size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1, marginBottom: 10 }} showsVerticalScrollIndicator={false}>
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
                  : styles.aiBubble,
              ]}
            >
              <Text style={[styles.chatText, msg.isError && { color: '#fca5a5' }]}>{msg.content}</Text>
            </View>
          ))}
          {loading && (
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
