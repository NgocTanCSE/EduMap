import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { apiService } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Avatar } from '../components/ui/Avatar';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'Leaderboard'>;

export const LeaderboardScreen: React.FC<Props> = () => {
  const { data, loading, error } = useAsync(() => apiService.getLeaderboard());
  const users: any[] = data?.data || data || [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bảng xếp hạng</Text>
      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có dữ liệu</Text>}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Avatar uri={item.avatar_url} size={36} />
              <Text style={styles.name}>{item.full_name || item.name || `Người dùng #${item.id}`}</Text>
              <Text style={styles.points}>{item.points || item.total_points || 0} pts</Text>
            </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  rank: { color: Colors.primary, fontWeight: '700', width: 32 },
  name: { color: Colors.text, flex: 1 },
  points: { color: Colors.primary, fontWeight: '700' },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default LeaderboardScreen;
