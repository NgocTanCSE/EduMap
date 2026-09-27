import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'CheckEligibility'>;

export const CheckEligibilityScreen: React.FC<Props> = ({ route }) => {
  const { scholarshipId } = route.params;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const check = async () => {
    setLoading(true);
    try {
      const res = await apiService.checkEligibility(scholarshipId);
      setResult(res?.data || res);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không kiểm tra được');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    check();
  }, [scholarshipId]);

  const eligible = result?.eligible ?? result?.is_eligible;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kiểm tra điều kiện</Text>
      {loading ? (
        <LoadingSpinner text="Đang kiểm tra..." />
      ) : result ? (
        <View style={styles.card}>
          <Text style={[styles.result, { color: eligible ? Colors.success : Colors.danger }]}>
            {eligible ? 'Bạn ĐẠT ĐIỀU KIỆN' : 'Bạn chưa đạt đủ điều kiện'}
          </Text>
          <Text style={styles.reason}>{result.reason || result.message || ''}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.btn} onPress={check}>
          <Text style={styles.btnText}>Kiểm tra lại</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  result: { fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center', marginVertical: 8 },
  reason: { color: Colors.textSecondary, fontSize: FontSize.sm },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.md },
  btnText: { color: Colors.background, fontWeight: '600' },
});

export default CheckEligibilityScreen;
