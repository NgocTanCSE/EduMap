import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { apiService } from '../services/api';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'SubmitActivity'>;

export const SubmitActivityScreen: React.FC<Props> = ({ navigation }) => {
  const [challengeId, setChallengeId] = useState('');
  const [description, setDescription] = useState('');
  const [proof, setProof] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return Alert.alert('Lỗi', 'Mô tả hoạt động');
    setSubmitting(true);
    try {
      await apiService.submitActivity({
        challenge_id: challengeId || undefined,
        description,
        proof: proof || undefined,
      });
      Alert.alert('Thành công', 'Hoạt động đã gửi để duyệt', [{ text: 'OK', onPress: () => navigation.pop(2) }]);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Gửi thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gửi hoạt động</Text>
      <Text style={styles.label}>Challenge ID (tùy chọn)</Text>
      <TextInput style={styles.input} placeholder="challenge_id" value={challengeId} onChangeText={setChallengeId} placeholderTextColor={Colors.textMuted} />
      <Text style={styles.label}>Mô tả</Text>
      <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top' }]} placeholder="Hoạt động của bạn..." value={description} onChangeText={setDescription} multiline placeholderTextColor={Colors.textMuted} />
      <Text style={styles.label}>Link chứng minh (URL/ảnh)</Text>
      <TextInput style={styles.input} placeholder="https://..." value={proof} onChangeText={setProof} placeholderTextColor={Colors.textMuted} />
      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.btnText}>{submitting ? 'Đang gửi...' : 'Gửi'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: 4 },
  input: { backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  btnText: { color: Colors.background, fontWeight: '600', fontSize: FontSize.base },
});

export default SubmitActivityScreen;
