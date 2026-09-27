import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { authService } from '../services/auth.service';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'UpdateProfile'>;

export const UpdateProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await authService.getProfile();
        setForm(res?.data || res);
      } catch (e: any) {
        Alert.alert('Lỗi', e?.message || 'Không tải được hồ sơ');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authService.updateProfile(form);
      Alert.alert('Thành công', 'Hồ sơ đã cập nhật', [{ text: 'OK', onPress: () => navigation.pop() }]);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner text="Đang tải..." />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cập nhật hồ sơ</Text>
      <Field label="Họ tên" value={form?.full_name || form?.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
      <Field label="Email" value={form?.email} onChange={(v) => setForm({ ...form, email: v })} editable={false} />
      <Field label="SĐT" value={form?.phone} onChange={(v) => setForm({ ...form, phone: v })} />
      <Field label="Avatar URL" value={form?.avatar_url} onChange={(v) => setForm({ ...form, avatar_url: v })} />
      <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Đang lưu...' : 'Lưu'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const Field: React.FC<{ label: string; value?: string; onChange: (v: string) => void; editable?: boolean }> = ({
  label,
  value,
  onChange,
  editable = true,
}) => (
  <View style={{ marginBottom: Spacing.sm }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, { opacity: editable ? 1 : 0.5 }]}
      value={value || ''}
      onChangeText={onChange}
      editable={editable}
      placeholderTextColor={Colors.textMuted}
    />
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

export default UpdateProfileScreen;
