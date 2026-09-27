import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAsync } from '../hooks/useAsync';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'UserProfileScreen'>;

export const UserProfileScreen: React.FC<Props> = () => {
  const { data, loading, error, execute } = useAsync(() => apiService.getUserCareers());
  const [field, setField] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const careers: any[] = data?.data || data || [];

  const handleAdd = async () => {
    if (!field) return Alert.alert('Lỗi', 'Nhập ngành nghề');
    setSubmitting(true);
    try {
      await apiService.createUserCareer({ field, current_role: '', target_role: '', experience_years: 0, skills: [] });
      setField('');
      execute(() => apiService.getUserCareers());
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Thêm thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const skillsRes = useAsync(() => apiService.getUserSkills());

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hành trình sự nghiệp</Text>
      <View style={styles.row}>
        <TextInput style={styles.input} placeholder="Ngành nghề hiện tại" value={field} onChangeText={setField} placeholderTextColor={Colors.textMuted} />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.background} size="small" /> : <Text style={styles.addText}>Thêm</Text>}
        </TouchableOpacity>
      </View>

      {loading ? <LoadingSpinner text="Đang tải..." /> : (
        <View>
          {careers.map((c) => (
            <View key={c.id} style={styles.item}>
              <Text style={styles.itemTitle}>{c.field}</Text>
              {c.current_role ? <Text style={styles.itemSub}>Vai trò: {c.current_role}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.title, { marginTop: Spacing.md }]}>Kỹ năng</Text>
      {skillsRes.loading ? <LoadingSpinner text="Đang tải..." /> : (
        <View>
          {(skillsRes.data?.data || skillsRes.data || []).map((s: any, i: number) => (
            <View key={s.id || i} style={styles.item}>
              <Text style={styles.itemTitle}>{s.name || s.skill || s}</Text>
            </View>
          ))}
        </View>
      )}
      {error ? <Text style={styles.error}>Lỗi tải dữ liệu</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  input: { flex: 1, backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  addText: { color: Colors.background, fontWeight: '600' },
  item: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  itemTitle: { color: Colors.text, fontWeight: '600' },
  itemSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  error: { color: Colors.danger, marginTop: Spacing.sm },
});

export default UserProfileScreen;
