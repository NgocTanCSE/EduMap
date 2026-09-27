import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { apiService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Badge } from '../components/ui/Badge';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'MyProgress'>;

export const MyProgressScreen: React.FC<Props> = () => {
  const { data, loading, error } = useAsync(() => apiService.getMyProgress());
  const progress = data?.data || data || {};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tiến độ của tôi</Text>
      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <View style={styles.card}>
          <Text style={styles.stat}>Điểm số: {progress.points || 0}</Text>
          <Text style={styles.stat}>Cấp độ: {progress.level || 1}</Text>
          <Text style={styles.stat}>Huy hiệu: {progress.badges_count || progress.badges?.length || 0}</Text>
          <Text style={styles.stat}>Hoạt động hoàn thành: {progress.completed_activities || progress.completed || 0}</Text>
          <View style={styles.row}>
            <Badge label={progress.next_badge || 'Bước kế tiếp'} variant="secondary" />
          </View>
        </View>
      )}
      {error ? <Text style={styles.error}>Lỗi tải dữ liệu</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  stat: { color: Colors.text, fontSize: FontSize.base },
  row: { marginTop: Spacing.sm },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default MyProgressScreen;
