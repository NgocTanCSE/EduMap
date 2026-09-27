import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { apiService } from '../services/api';
import { GraduationCap } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'LearningPath'>;

export const LearningPathScreen: React.FC<Props> = () => {
  const [goals, setGoals] = useState('');
  const [background, setBackground] = useState('');
  const [interests, setInterests] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!goals.trim()) return Alert.alert('Lỗi', 'Nhập mục tiêu học tập');
    setLoading(true);
    try {
      const res = await apiService.learningPath({
        goals,
        background,
        interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setResult(res?.data || res);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không tạo được lộ trình');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
        <GraduationCap size={22} color={Colors.primary} />
        <Text style={styles.title}>Lộ trình học AI</Text>
      </View>
      <TextInput style={inputS} placeholder="Mục tiêu (ví dụ: trở thành AI engineer)" value={goals} onChangeText={setGoals} placeholderTextColor={Colors.textMuted} />
      <TextInput style={inputS} placeholder="Nền tảng hiện tại (tùy chọn)" value={background} onChangeText={setBackground} placeholderTextColor={Colors.textMuted} />
      <TextInput style={inputS} placeholder="Sở thích (phân cách bằng dấu phẩy)" value={interests} onChangeText={setInterests} placeholderTextColor={Colors.textMuted} />
      <TouchableOpacity style={btnS} onPress={handleGenerate} disabled={loading}>
        {loading ? <ActivityIndicator color={Colors.background} /> : <Text style={btnTextS}>Tạo lộ trình</Text>}
      </TouchableOpacity>
      {result && <View style={{ marginTop: Spacing.md }}><Text style={{ color: Colors.text, lineHeight: 18 }}>{JSON.stringify(result, null, 2)}</Text></View>}
    </ScrollView>
  );
};

const inputS = { backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border } as const;
const btnS = { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center' } as const;
const btnTextS = { color: Colors.background, fontWeight: '600', fontSize: FontSize.base } as const;
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: Colors.background }, title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' } });

export default LearningPathScreen;
