import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAsync } from '../hooks/useAsync';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'CareerJobs'>;

export const CareerJobsScreen: React.FC<Props> = ({ navigation }) => {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, execute } = useAsync(() => apiService.getCareerJobs({ page, limit: 10, q }));

  const items: any[] = data?.data || data || [];
  const hasMore = items.length >= page * 10;

  const loadPage = (p: number) => {
    setPage(p);
    execute(() => apiService.getCareerJobs({ page: p, limit: 10, q }));
  };

  const onSearch = () => {
    setPage(1);
    execute(() => apiService.getCareerJobs({ page: 1, limit: 10, q }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Tìm việc theo tên công ty/tiêu đề..."
          value={q}
          onChangeText={setQ}
          onSubmitEditing={onSearch}
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity onPress={onSearch} style={styles.searchBtn}>
          <Text style={styles.searchText}>Tìm</Text>
        </TouchableOpacity>
      </View>
      {loading && page === 1 ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Không tìm thấy việc làm</Text>}
          onEndReached={() => { if (hasMore && !loading) loadPage(page + 1); }}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('JobDetail', { id: item.id })}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>{item.company}</Text>
              <Text style={styles.cardMeta}>{item.type || item.location || ''}</Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={loading && hasMore ? <ActivityIndicator color={Colors.primary} style={{ margin: 10 }} /> : null}
        />
      )}
      {error ? <Text style={styles.error}>Lỗi tải dữ liệu</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  input: { flex: 1, backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  searchBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  searchText: { color: Colors.background, fontWeight: '600' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: Colors.text, fontSize: FontSize.base, fontWeight: '600' },
  cardSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  cardMeta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 4 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default CareerJobsScreen;
