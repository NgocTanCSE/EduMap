import React from 'react';
import { Text, View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useAsync } from '../hooks/useAsync';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'ChatHistory'>;

export const ChatHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { data, loading, error } = useAsync(() => apiService.getChatHistory());

  const items: any[] = (data?.data || data || []).map((m: any, i: number) => ({ ...m, id: m.id || `${i}` }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lịch sử trò chuyện</Text>
      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có lịch sử</Text>}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text style={styles.prompt}>{item.prompt || item.message || item.question}</Text>
              <Text style={styles.reply} numberOfLines={3}>{item.reply || item.response || item.content}</Text>
            </View>
          )}
        />
      )}
      {error ? <Text style={styles.error}>Lỗi tải lịch sử</Text> : null}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.replace('Chat')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  item: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  prompt: { color: Colors.text, fontWeight: '600', fontSize: FontSize.sm },
  reply: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 4 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: { color: Colors.danger, marginTop: Spacing.sm },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  fabText: { color: Colors.background, fontSize: 28, fontWeight: '700' },
});

export default ChatHistoryScreen;
