import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import greenService from '../services/green.service';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'LogActivity'>;

export const LogActivityScreen: React.FC<Props> = ({ navigation, route }) => {
  const { challengeId } = route.params || {};
  const [carbon, setCarbon] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!challengeId) return Alert.alert('Lỗi', 'Chọn thử thách');
    setSubmitting(true);
    try {
      await greenService.logActivity({ challengeId, carbonSavedKg: Number(carbon) || 0 });
      Alert.alert('Thành công', 'Hoạt động đã được ghi nhận', [{ text: 'OK', onPress: () => navigation.pop(2) }]);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Ghi nhận thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ghi nhận hoạt động xanh</Text>
      <Text style={styles.label}>Challenge ID: {challengeId || '(chưa chọn)'}</Text>
      <Text style={styles.label}>Khí thải tiết kiệm (kg)</Text>
      <TextInput style={styles.input} placeholder="1.0" keyboardType="numeric" value={carbon} onChangeText={setCarbon} placeholderTextColor={Colors.textMuted} />
      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.btnText}>{submitting ? 'Đang ghi nhận...' : 'Xác nhận'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: 4 },
  input: { backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  btn: { backgroundColor: Colors.success, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  btnText: { color: Colors.background, fontWeight: '600', fontSize: FontSize.base },
});

export default LogActivityScreen;
