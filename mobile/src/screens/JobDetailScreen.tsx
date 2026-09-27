import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { useAsync } from '../hooks/useAsync';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'JobDetail'>;

export const JobDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const { data, loading, error } = useAsync(() => apiService.getCareerJob(id));
  const job = data?.data || data || {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md }}>
      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <>
          <Text style={styles.title}>{job.title || 'Chi tiết việc làm'}</Text>
          <Text style={styles.company}>{job.company}</Text>
          <Text style={styles.meta}>{job.location || ''} · {job.type || ''} · {job.salary || ''}</Text>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mô tả công việc</Text>
            <Text style={styles.body}>{job.description || 'Chưa có mô tả'}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Yêu cầu</Text>
            <Text style={styles.body}>{job.requirements || 'Chưa có yêu cầu'}</Text>
          </View>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={async () => {
              try {
                await apiService.applyToJob(job.id, {});
                Alert.alert('Thành công', 'Đã nộp đơn ứng tuyển');
              } catch (e: any) {
                // Fallback: open external link if provided
                if (job.apply_url) await Linking.openURL(job.apply_url);
                else Alert.alert('Lỗi', e?.message || 'Nộp đơn thất bại');
              }
            }}
          >
            <Text style={styles.applyText}>Nộp đơn ngay</Text>
          </TouchableOpacity>
        </>
      )}
      {error ? <Text style={styles.error}>Lỗi tải dữ liệu</Text> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: 4 },
  company: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  meta: { color: Colors.textSecondary, fontSize: FontSize.sm, marginVertical: 4 },
  section: { marginTop: Spacing.md },
  sectionTitle: { color: Colors.text, fontWeight: '700', marginBottom: 6 },
  body: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  applyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.lg },
  applyText: { color: Colors.background, fontWeight: '700', fontSize: FontSize.base },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default JobDetailScreen;
