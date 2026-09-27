import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useAsync } from '../hooks/useAsync';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'ResourceDetail'>;

export const ResourceDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const { data, loading, error } = useAsync(() => apiService.getResource(id));
  const summary = useAsync(() => apiService.getResourceSummary(id));
  const resource = data?.data || data || {};

  const open = async () => {
    if (resource.file_url) await Linking.openURL(resource.file_url);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md }}>
      {loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <>
          <Text style={styles.title}>{resource.title || 'Tài nguyên'}</Text>
          <Text style={styles.sub}>{resource.author && `Tác giả: ${resource.author}`}</Text>
          <Text style={styles.meta}>{resource.type || ''} · {resource.category || ''}</Text>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mô tả</Text>
            <Text style={styles.body}>{resource.description || 'Không có mô tả'}</Text>
          </View>
          {resource.tags ? (
            <View style={styles.tags}>
              {resource.tags.map((t: string) => (
                <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
              ))}
            </View>
          ) : null}

          {summary.data ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tóm tắt AI</Text>
              <Text style={styles.body}>{summary.data?.summary || summary.data}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.btn} onPress={open}>
            <Text style={styles.btnText}>Mở tài liệu</Text>
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
  sub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  meta: { color: Colors.textMuted, fontSize: FontSize.xs, marginVertical: 4 },
  section: { marginTop: Spacing.md },
  sectionTitle: { color: Colors.text, fontWeight: '700', marginBottom: 6 },
  body: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm },
  tag: { backgroundColor: Colors.card, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { color: Colors.textSecondary, fontSize: FontSize.xs },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.lg },
  btnText: { color: Colors.background, fontWeight: '600' },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default ResourceDetailScreen;
