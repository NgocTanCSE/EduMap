import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { apiService } from '../services/api';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'ApplyScholarship'>;

export const ApplyScholarshipScreen: React.FC<Props> = ({ navigation, route }) => {
  const { scholarshipId } = route.params;
  const [statement, setStatement] = useState('');
  const [cvUrl, setCvUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleApply = async () => {
    if (!statement.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập thuyết minh');
    setSubmitting(true);
    try {
      await apiService.applyScholarship(scholarshipId, { personal_statement: statement, cv_url: cvUrl || undefined });
      Alert.alert('Thành công', 'Đơn ứng tuyển đã được gửi', [{ text: 'OK', onPress: () => navigation.popToTop() }]);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Gửi đơn thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nộp đơn học bổng</Text>
      <Text style={styles.label}>Thuyết minh (tại sao bạn xứng đáng)</Text>
      <TextInput
        style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
        placeholder="Nêu lý do và mục tiêu của bạn..."
        value={statement}
        onChangeText={setStatement}
        multiline
        placeholderTextColor={Colors.textMuted}
      />
      <Text style={styles.label}>Link CV/hoạt động (tùy chọn)</Text>
      <TextInput style={styles.input} placeholder="https://..." value={cvUrl} onChangeText={setCvUrl} placeholderTextColor={Colors.textMuted} />
      <TouchableOpacity style={styles.btn} onPress={handleApply} disabled={submitting}>
        <Text style={styles.btnText}>{submitting ? 'Đang gửi...' : 'Gửi đơn'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center' },
  btnText: { color: Colors.background, fontWeight: '600', fontSize: FontSize.base },
});

export default ApplyScholarshipScreen;
