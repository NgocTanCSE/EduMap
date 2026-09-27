import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'ScholarshipDetail'>;

export const ScholarshipDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { id, title, description, amount, deadline, requirements, status } = route.params;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md }}>
      <Text style={styles.title}>{title || 'Chi tiết học bổng'}</Text>
      <Text style={styles.amount}>{amount ? `$${amount}` : 'Số tiền: Liên hệ'}</Text>
      <Text style={styles.deadline}>Hạn nộp: {deadline || 'Chưa có'}</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Miêu tả</Text>
        <Text style={styles.body}>{description || 'Chưa có mô tả'}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Yêu cầu</Text>
        <Text style={styles.body}>{requirements || 'Chưa có yêu cầu'}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => navigation.navigate('CheckEligibility', { scholarshipId: id })}>
          <Text style={styles.btnTextPrimary}>Kiểm tra điều kiện</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => navigation.navigate('ApplyScholarship', { scholarshipId: id })}>
          <Text style={styles.btnTextOutline}>Nộp đơn</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: 4 },
  amount: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600', marginVertical: 4 },
  deadline: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.sm },
  section: { marginTop: Spacing.md },
  sectionTitle: { color: Colors.text, fontWeight: '700', marginBottom: 6 },
  body: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  btn: { flex: 1, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center' },
  btnPrimary: { backgroundColor: Colors.primary },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.primary },
  btnTextPrimary: { color: Colors.background, fontWeight: '600' },
  btnTextOutline: { color: Colors.primary, fontWeight: '600' },
});

export default ScholarshipDetailScreen;
