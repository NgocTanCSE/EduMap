import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useAsync } from '../hooks/useAsync';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'CareerRoadmap'>;

export const CareerRoadmapScreen: React.FC<Props> = ({ route }) => {
  const { careerId } = route.params;
  const { data, loading, error } = useAsync(() => apiService.getRoadmap(careerId));
  const roadmap = data?.data || data || {};

  const phases = roadmap.phases || [];

  const renderPhase = ({ item }: { item: any }) => (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>{item.name}</Text>
      {Array.isArray(item.skills) ? (
        <FlatList
          data={item.skills}
          keyExtractor={(s, i) => `${item.name}-${i}`}
          renderItem={({ item: s }) => <Text style={styles.skill}>• {s}</Text>}
        />
      ) : null}
      {item.estimated_weeks ? <Text style={styles.weeks}>~{item.estimated_weeks} tuần</Text> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{roadmap.title || 'Lộ trình phát triển'}</Text>
      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : phases.length === 0 ? (
        <Text style={styles.empty}>Chưa có lộ trình chi tiết</Text>
      ) : (
        <FlatList data={phases} keyExtractor={(p, i) => `${p.name}-${i}`} renderItem={renderPhase} />
      )}
      {error ? <Text style={styles.error}>Lỗi tải dữ liệu</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  phase: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  phaseTitle: { color: Colors.text, fontWeight: '600', marginBottom: 6 },
  skill: { color: Colors.textSecondary, fontSize: FontSize.sm, marginVertical: 1 },
  weeks: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 4 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default CareerRoadmapScreen;
