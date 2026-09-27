import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useAsync } from '../hooks/useAsync';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'MyBookings'>;

export const MyBookingsScreen: React.FC<Props> = () => {
  const { data, loading, error } = useAsync(() => apiService.getMyBookings());
  const bookings: any[] = data?.data || data || [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lịch hẹn của tôi</Text>
      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có lịch hẹn nào</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.mentor?.full_name || item.mentor_name || `Mentor #${item.mentor_id}`}</Text>
              <Text style={styles.cardSub}>{item.slot_start} → {item.slot_end || item.slot_start}</Text>
              <Text style={styles.cardMeta}>Trạng thái: {item.status}</Text>
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
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: Colors.text, fontWeight: '600' },
  cardSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  cardMeta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default MyBookingsScreen;
