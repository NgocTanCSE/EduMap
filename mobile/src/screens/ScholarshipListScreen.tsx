import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'ScholarshipList'>;

export const ScholarshipListScreen: React.FC<Props> = ({ navigation, route }) => {
  const [q, setQ] = useState(route.params?.query || '');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getScholarships({ page: 1, limit: 20, q });
      const list = res?.data || res || [];
      setData(Array.isArray(list) ? list : []);
      setError(null);
    } catch (e: any) {
      setError(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  const onSearch = () => {
    fetchList();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Học bổng</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Tìm theo tên, số tiền..."
          value={q}
          onChangeText={setQ}
          onSubmitEditing={onSearch}
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity onPress={onSearch} style={styles.searchBtn}>
          <Text style={styles.searchText}>Tìm</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Không tìm thấy học bổng</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('ScholarshipDetail', {
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  amount: item.amount,
                  deadline: item.deadline,
                  requirements: item.requirements,
                  status: item.status,
                })
              }
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>{item.category || ''} · {item.deadline || ''}</Text>
              <Text style={styles.cardAmount}>{item.amount ? `$${item.amount}` : ''}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      {error ? <Text style={styles.error}>Lỗi tải dữ liệu</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  input: { flex: 1, backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  searchBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  searchText: { color: Colors.background, fontWeight: '600' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: Colors.text, fontWeight: '600', fontSize: FontSize.base },
  cardSub: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  cardAmount: { color: Colors.primary, fontWeight: '700', marginTop: 4, fontSize: FontSize.sm },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default ScholarshipListScreen;
