import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import mentorService from '../services/mentor.service';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'BookMentor'>;

export const BookMentorScreen: React.FC<Props> = ({ navigation, route }) => {
  const { mentorId } = route.params;
  const [slot, setSlot] = useState({ start: '', end: '' });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBook = async () => {
    if (!slot.start || !slot.end) return Alert.alert('Lỗi', 'Chọn khung giờ');
    setSubmitting(true);
    try {
      await mentorService.bookSession(mentorId, { start: slot.start, end: slot.end }, notes);
      Alert.alert('Thành công', 'Đặt lịch thành công', [{ text: 'OK', onPress: () => navigation.pop(2) }]);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Đặt lịch thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đặt lịch - Mentor {mentorId}</Text>
      <Text style={styles.label}>Thời gian bắt đầu (ISO datetime)</Text>
      <TextInput style={styles.input} placeholder="2025-01-01T08:00:00Z" value={slot.start} onChangeText={(v) => setSlot({ ...slot, start: v })} placeholderTextColor={Colors.textMuted} />
      <Text style={styles.label}>Thời gian kết thúc (ISO datetime)</Text>
      <TextInput style={styles.input} placeholder="2025-01-01T09:00:00Z" value={slot.end} onChangeText={(v) => setSlot({ ...slot, end: v })} placeholderTextColor={Colors.textMuted} />
      <Text style={styles.label}>Ghi chú</Text>
      <TextInput style={styles.input} placeholder="Mục tiêu buổi mentor..." value={notes} onChangeText={setNotes} placeholderTextColor={Colors.textMuted} />
      <TouchableOpacity style={styles.btn} onPress={handleBook} disabled={submitting}>
        <Text style={styles.btnText}>{submitting ? 'Đang đặt...' : 'Xác nhận đặt lịch'}</Text>
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

export default BookMentorScreen;
