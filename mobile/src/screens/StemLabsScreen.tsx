import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'StemLabs'>;

export const StemLabsScreen: React.FC<Props> = ({ navigation }) => {
  const [q, setQ] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchLabs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getStemLabs({ q });
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
    fetchLabs();
  }, [fetchLabs]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Phòng thí nghiệm STEM</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Tìm phòng thí nghiệm..."
          value={q}
          onChangeText={setQ}
          onSubmitEditing={fetchLabs}
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity onPress={fetchLabs} style={styles.searchBtn}>
          <Text style={styles.searchText}>Tìm</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Không tìm thấy phòng thí nghiệm</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('BookEquipment', { labId: item.id })}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSub}>{item.location || ''}</Text>
              <Text style={styles.cardMeta}>{item.description || ''}</Text>
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
  cardSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  cardMeta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 4 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default StemLabsScreen;
