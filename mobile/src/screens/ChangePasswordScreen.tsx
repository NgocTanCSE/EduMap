import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { authService } from '../services/auth.service';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'ChangePassword'>;

export const ChangePasswordScreen: React.FC<Props> = () => {
  const [form, setForm] = useState({ old_password: '', new_password: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!form.old_password || !form.new_password) return Alert.alert('Lỗi', 'Điền đầy đủ mật khẩu');
    if (form.new_password.length < 6) return Alert.alert('Lỗi', 'Mật khẩu mới tối thiểu 6 ký tự');
    setSubmitting(true);
    try {
      await authService.changePassword(form.old_password, form.new_password);
      Alert.alert('Thành công', 'Đổi mật khẩu thành công');
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đổi mật khẩu</Text>
      <Field label="Mật khẩu cũ" value={form.old_password} onChange={(v) => setForm({ ...form, old_password: v })} secure />
      <Field label="Mật khẩu mới" value={form.new_password} onChange={(v) => setForm({ ...form, new_password: v })} secure />
      <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={submitting}>
        <Text style={styles.btnText}>{submitting ? 'Đang lưu...' : 'Lưu'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; secure?: boolean }> = ({
  label,
  value,
  onChange,
  secure,
}) => (
  <View style={{ marginBottom: Spacing.sm }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} value={value} onChangeText={onChange} secureTextEntry={secure} placeholderTextColor={Colors.textMuted} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: 4 },
  input: { backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  btnText: { color: Colors.background, fontWeight: '600', fontSize: FontSize.base },
});

export default ChangePasswordScreen;
