import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { apiService } from '../services/api';
import { Send } from 'lucide-react-native';

export default function ChatScreen() {
  const [chatMessages, setChatMessages] = useState<{role: string, content: string, isError?: boolean}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const history = chatMessages.map(m => ({ role: m.role, content: m.content }));
      const response = await apiService.sendChatMessage(userMsg, history);
      
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.reply || response.message || 'Xin lỗi, mình gặp chút trục trặc.',
        isError: response.error 
      }]);
    } catch (error: any) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Không thể kết nối đến máy chủ AI (Timeout 10s). Vui lòng kiểm tra lại kết nối mạng.',
        isError: true 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ flex: 1, marginBottom: 10 }}>
          {chatMessages.length === 0 && (
            <Text style={{ color: '#666', textAlign: 'center', marginTop: 50 }}>Hãy hỏi AI về học bổng, trường học, hay kiến thức...</Text>
          )}
          {chatMessages.map((msg, index) => (
            <View key={index} style={[styles.chatBubble, msg.role === 'user' ? styles.userBubble : (msg.isError ? styles.errorBubble : styles.aiBubble)]}>
              <Text style={[styles.chatText, msg.isError && { color: '#fca5a5' }]}>{msg.content}</Text>
            </View>
          ))}
          {chatLoading && (
            <View style={[styles.chatBubble, styles.aiBubble, { width: 60 }]}>
              <ActivityIndicator size="small" color="#eab308" />
            </View>
          )}
        </ScrollView>
        <View style={styles.chatInputContainer}>
          <TextInput
            style={styles.chatInput}
            placeholder="Nhập câu hỏi..."
            placeholderTextColor="#666"
            value={chatInput}
            onChangeText={setChatInput}
            onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage} disabled={chatLoading}>
            <Send size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#09090b',
  },
  chatBubble: {
    padding: 15,
    borderRadius: 20,
    marginBottom: 10,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: '#27272a',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  errorBubble: {
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  chatText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#eab308',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
