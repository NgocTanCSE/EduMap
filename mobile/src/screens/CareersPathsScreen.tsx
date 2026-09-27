import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useAsync } from '../hooks/useAsync';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'CareersPaths'>;

export const CareersPathsScreen: React.FC<Props> = ({ navigation }) => {
  const { data, loading, error } = useAsync(() => apiService.getCareerPaths());
  const items: any[] = data?.data || data || [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lĩnh vực ngành nghề</Text>
      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có dữ liệu</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('CareerRoadmap', { careerId: item.id })}
            >
              <Text style={styles.cardTitle}>{item.title || item.field}</Text>
              <Text style={styles.cardSub} numberOfLines={2}>{item.description}</Text>
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
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: Colors.text, fontWeight: '600', fontSize: FontSize.base },
  cardSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 4 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default CareersPathsScreen;
