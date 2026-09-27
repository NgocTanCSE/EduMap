import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';
import { Search } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'AiSearch'>;

export const AiSearchScreen: React.FC<Props> = () => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await apiService.aiSearch(q, 10);
      setResults(res?.data || res || []);
    } catch (e: any) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Tìm kiếm tri thức AI..."
          value={q}
          onChangeText={setQ}
          onSubmitEditing={handleSearch}
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity onPress={handleSearch} style={styles.iconBtn} disabled={loading}>
          <Search size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(_, i) => `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Nhập từ khóa và nhấn tìm kiếm</Text>}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text style={styles.title}>{item.title || item.question}</Text>
              <Text style={styles.body} numberOfLines={3}>{item.answer || item.content || item.snippet}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  input: { flex: 1, backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  item: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  title: { color: Colors.text, fontWeight: '600' },
  body: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 4 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
});

export default AiSearchScreen;
