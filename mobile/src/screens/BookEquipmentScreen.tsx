import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { apiService } from '../services/api';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'BookEquipment'>;

export const BookEquipmentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { labId } = route.params;
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBook = async () => {
    if (!start || !end) return Alert.alert('Lỗi', 'Chọn thời gian');
    setSubmitting(true);
    try {
      await apiService.bookEquipment(labId, {
        equipment_id: equipmentId || undefined,
        slot_start: start,
        slot_end: end,
        purpose,
        participants: 1,
      });
      Alert.alert('Thành công', 'Đặt thiết bị thành công', [{ text: 'OK', onPress: () => navigation.pop(2) }]);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Đặt thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đặt thiết bị - Lab {labId}</Text>
      <Text style={styles.label}>Thời gian bắt đầu (ISO datetime)</Text>
      <TextInput style={styles.input} placeholder="2025-01-01T08:00:00Z" value={start} onChangeText={setStart} placeholderTextColor={Colors.textMuted} />
      <Text style={styles.label}>Thời gian kết thúc (ISO datetime)</Text>
      <TextInput style={styles.input} placeholder="2025-01-01T10:00:00Z" value={end} onChangeText={setEnd} placeholderTextColor={Colors.textMuted} />
      <Text style={styles.label}>ID thiết bị (tùy chọn)</Text>
      <TextInput style={styles.input} placeholder="equipment_id" value={equipmentId} onChangeText={setEquipmentId} placeholderTextColor={Colors.textMuted} />
      <Text style={styles.label}>Mục đích sử dụng</Text>
      <TextInput style={styles.input} placeholder="Nghiên cứu..." value={purpose} onChangeText={setPurpose} placeholderTextColor={Colors.textMuted} />
      <TouchableOpacity style={styles.btn} onPress={handleBook} disabled={submitting}>
        <Text style={styles.btnText}>{submitting ? 'Đang đặt...' : 'Xác nhận đặt'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: 4 },
  input: { backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  btnText: { color: Colors.background, fontWeight: '600', fontSize: FontSize.base },
});

export default BookEquipmentScreen;
