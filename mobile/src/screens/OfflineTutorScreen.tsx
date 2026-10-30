/**
 * Mobile screen: OfflineTutorScreen
 *
 * Edge AI Tutor (Idea #7) — AI tutoring powered by the ai-service text
 * cascade (DeepSeek → Gemini → Cloudflare) with Vietnamese template fallback.
 *
 * Three modes:
 *  - Explain: explain a concept
 *  - Practice: generate practice questions
 *  - Suggest: suggest next learning step
 *
 * Usage:
 *  1. Select a tutor action (Explain / Practice / Suggest)
 *  2. Enter a topic
 *  3. (Optional) Add material context, difficulty, or progression info
 *  4. Send — the request goes to the BFF → backend → ai-service offline endpoint
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Alert,
} from 'react-native';
import { Colors, FontSize } from '../theme';
import { aiService } from '../services/ai.service';
import type { ScreenProps } from '../navigation/types';

type OfflineTutorScreenProps = ScreenProps<'OfflineTutor'>;

type TutorAction = 'explain' | 'practice' | 'suggest';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  degraded?: boolean;
  source?: string;
  questions?: Array<{ question: string; answer: string; difficulty: string }>;
  nextStep?: string;
  estimatedTime?: string;
}

const ACTIONS: { value: TutorAction; label: string; icon: string }[] = [
  { value: 'explain', label: 'Giải thích', icon: '📖' },
  { value: 'practice', label: 'Luyện tập', icon: '✏️' },
  { value: 'suggest', label: 'Đề xuất', icon: '🎯' },
];

export default function OfflineTutorScreen({ navigation }: OfflineTutorScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [selectedAction, setSelectedAction] = useState<TutorAction>('explain');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [numQuestions, setNumQuestions] = useState('3');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic || isLoading) return;

    Keyboard.dismiss();

    // Build request payload based on selected action
    const payload: Record<string, any> = {
      action: selectedAction,
      topic: trimmedTopic,
    };

    if (selectedAction === 'explain' && context.trim()) {
      payload.material_context = context.trim();
    } else if (selectedAction === 'practice') {
      payload.difficulty = difficulty;
      payload.num_questions = Math.max(1, Math.min(5, parseInt(numQuestions) || 3));
    } else if (selectedAction === 'suggest' && context.trim()) {
      payload.progression = {
        topics_studied: trimmedTopic.split(',').map((t) => t.trim()),
        current_level: difficulty,
        goals: context.trim(),
      };
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedTopic,
    };
    setMessages((prev) => [...prev, userMsg]);
    setTopic('');
    setIsLoading(true);

    try {
      const result = await aiService.offlineTutor(payload);

      let assistantContent = '';
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        degraded: result?.degraded || false,
        source: result?.source || 'unknown',
      };

      if (selectedAction === 'explain') {
        assistantMsg.content = result?.text || 'Không có nội dung.';
      } else if (selectedAction === 'practice') {
        const questions = result?.questions || [];
        assistantMsg.questions = questions;
        assistantMsg.content = questions
          .map(
            (q: any, i: number) =>
              `Câu ${i + 1} (${q.difficulty || 'medium'}): ${q.question}\n→ ${q.answer || 'Xem lời giải'}`,
          )
          .join('\n\n');
      } else if (selectedAction === 'suggest') {
        assistantMsg.nextStep = result?.next_step || '';
        assistantMsg.estimatedTime = result?.estimated_time || '';
        assistantMsg.content = result?.next_step
          ? `Bước tiếp theo: ${result.next_step}${result.estimated_time ? `\n⏱️ ${result.estimated_time}` : ''}`
          : 'Không có đề xuất nào.';
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Không thể kết nối tới trợ lý AI ngoại tuyến.',
        degraded: true,
        source: 'network-error',
      };
      setMessages((prev) => [...prev, errorMsg]);
      Alert.alert('Lỗi', err?.message || 'Không thể kết nối tới trợ lý AI');
    } finally {
      setIsLoading(false);
    }
  }, [topic, context, selectedAction, difficulty, numQuestions, isLoading]);

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      style={[
        styles.messageBubble,
        item.role === 'user' ? styles.userBubble : styles.assistantBubble,
        item.degraded && styles.degradedBubble,
      ]}
    >
      {item.questions && item.questions.length > 0 ? (
        item.questions.map((q, i) => (
          <View key={i} style={styles.questionCard}>
            <Text style={styles.questionText}>Câu {i + 1} ({q.difficulty}): {q.question}</Text>
            <Text style={styles.answerText}>→ {q.answer || 'Chưa có lời giải'}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.messageText}>{item.content || 'Đang xử lý...'}</Text>
      )}
      {item.degraded && (
        <Text style={styles.degradedBadge}>Bản sao mẫu (không có AI)</Text>
      )}
      {item.estimatedTime && (
        <Text style={styles.timeEstimate}>⏱️ {item.estimatedTime}</Text>
      )}
    </View>
  );

  const renderActionSelector = () => (
    <View style={styles.actionRow}>
      {ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.value}
          style={[
            styles.actionButton,
            selectedAction === action.value && styles.actionButtonActive,
          ]}
          onPress={() => setSelectedAction(action.value)}
        >
          <Text style={styles.actionIcon}>{action.icon}</Text>
          <Text style={[styles.actionLabel, selectedAction === action.value && styles.actionLabelActive]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📚 Trợ lý ngoại tuyến</Text>
        <Text style={styles.headerSubtitle}>AI cục bộ — không cần internet</Text>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📱</Text>
            <Text style={styles.emptyText}>
              Hỏi về bất kỳ chủ đề nào — AI chạy trực tiếp trên thiết bị.
            </Text>
          </View>
        }
      />

      {/* Input area */}
      <View style={styles.inputContainer}>
        {renderActionSelector()}

        <TextInput
          style={styles.input}
          value={topic}
          onChangeText={setTopic}
          placeholder={
            selectedAction === 'explain'
              ? 'Nhập chủ đề cần giải thích...'
              : selectedAction === 'practice'
              ? 'Nhập chủ đề cần luyện tập...'
              : 'Nhập chương đã học...'
          }
          onSubmitEditing={sendMessage}
        />

        {(selectedAction === 'explain' || selectedAction === 'suggest') && (
          <TextInput
            style={[styles.input, styles.contextInput]}
            value={context}
            onChangeText={setContext}
            placeholder={
              selectedAction === 'explain'
                ? 'Tài liệu tham khảo (tùy chọn)...'
                : 'Mục tiêu học tập (tùy chọn)...'
            }
          />
        )}

        {selectedAction === 'practice' && (
          <View style={styles.practiceControls}>
            <Text style={styles.controlLabel}>Độ khó:</Text>
            <View style={styles.difficultyRow}>
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.difficultyButton,
                    difficulty === d && styles.difficultyButtonActive,
                  ]}
                  onPress={() => setDifficulty(d)}
                >
                  <Text style={styles.difficultyText}>
                    {d === 'easy' ? 'Dễ' : d === 'medium' ? 'TB' : 'Khó'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.controlLabel}>Số câu:</Text>
            <TextInput
              style={styles.numInput}
              value={numQuestions}
              onChangeText={setNumQuestions}
              keyboardType="numeric"
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.sendButton, (!topic.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!topic.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Gửi</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  degradedBubble: {
    opacity: 0.75,
  },
  messageText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  degradedBadge: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    marginTop: 4,
  },
  timeEstimate: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  questionCard: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  questionText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  answerText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  inputContainer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  actionButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionIcon: {
    fontSize: FontSize.sm,
  },
  actionLabel: {
    fontSize: FontSize.xs,
    color: Colors.text,
  },
  actionLabelActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    color: Colors.text,
    backgroundColor: Colors.background,
    marginBottom: 8,
  },
  contextInput: {
    marginBottom: 4,
  },
  practiceControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  controlLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 4,
  },
  difficultyButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  difficultyButtonActive: {
    backgroundColor: Colors.primary,
  },
  difficultyText: {
    fontSize: FontSize.xs,
    color: Colors.text,
  },
  numInput: {
    width: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: FontSize.sm,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: 'white',
    fontSize: FontSize.sm,
    fontWeight: 'bold',
  },
});
