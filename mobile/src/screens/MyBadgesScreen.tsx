import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { apiService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Badge } from '../components/ui/Badge';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'MyBadges'>;

export const MyBadgesScreen: React.FC<Props> = () => {
  const { data, loading, error } = useAsync(() => apiService.getMyBadges());
  const items: any[] = data?.data || data || [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Huy hiệu của tôi</Text>
      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có huy hiệu nào</Text>}
          renderItem={({ item }) => {
            const badge = item.badge || item;
            return (
              <View style={styles.card}>
                <Text style={styles.name}>{badge?.name || item?.name || 'Huy hiệu'}</Text>
                <Badge label={badge?.rarity || item?.rarity || 'Rare'} variant="primary" />
                <Text style={styles.desc}>{badge?.description || item?.description || ''}</Text>
                <Text style={styles.date}>Đạt được: {item.earned_at || item.earnedAt || '—'}</Text>
              </View>
            );
          }}
        />
      )}
      {error ? <Text style={styles.error}>Lỗi tải dữ liệu</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  name: { color: Colors.text, fontWeight: '700', fontSize: FontSize.base },
  desc: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 4 },
  date: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default MyBadgesScreen;
