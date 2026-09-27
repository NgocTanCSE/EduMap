import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'AiAdvice'>;

export const AiAdviceScreen: React.FC<Props> = () => {
  const [skills, setSkills] = useState('');
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<any>(null);

  const handleGetAdvice = async () => {
    if (!skills.trim()) return;
    setLoading(true);
    try {
      const res = await apiService.getAiAdvice({ skills });
      setAdvice(res?.data || res);
    } catch (e: any) {
      setAdvice({ error: e?.message || 'Không lấy được lời khuyên' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lời khuyên từ AI</Text>
      <Text style={styles.label}>Kỹ năng hiện tại của bạn (phân cách bằng dấu phẩy)</Text>
      <TextInput
        style={styles.input}
        placeholder="ví dụ: JavaScript, React, SQL..."
        value={skills}
        onChangeText={setSkills}
        placeholderTextColor={Colors.textMuted}
      />
      <TouchableOpacity style={styles.btn} onPress={handleGetAdvice} disabled={loading}>
        {loading ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.btnText}>Nhận lời khuyên</Text>}
      </TouchableOpacity>
      {advice && (
        <View style={styles.result}>
          <Text style={styles.resultText}>{JSON.stringify(advice, null, 2)}</Text>
        </View>
      )}
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
  result: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  resultText: { color: Colors.text, fontSize: FontSize.sm },
});

export default AiAdviceScreen;
