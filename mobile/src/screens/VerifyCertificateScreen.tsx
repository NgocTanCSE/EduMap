import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';
import { apiService } from '../services/api';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'VerifyCertificate'>;

export const VerifyCertificateScreen: React.FC<Props> = ({ route }) => {
  const initialCode = route?.params?.code || '';
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleVerify = async () => {
    if (!code.trim()) return Alert.alert('Lỗi', 'Nhập mã chứng chỉ');
    setLoading(true);
    try {
      const res = await apiService.verifyCertificate(code);
      setResult(res?.data || res);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không xác minh được');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (initialCode) handleVerify();
  }, []);

  const valid = result?.valid;
  const cert = result?.certificate || result;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Xác minh chứng chỉ</Text>
      <TextInput style={styles.input} placeholder="Nhập mã chứng chỉ" value={code} onChangeText={setCode} placeholderTextColor={Colors.textMuted} onSubmitEditing={handleVerify} />
      <TouchableOpacity style={styles.btn} onPress={handleVerify} disabled={loading || !code.trim()}>
        {loading ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.btnText}>Xác minh</Text>}
      </TouchableOpacity>

      {result && (
        <View style={styles.result}>
          <Text style={[styles.valid, { color: valid ? Colors.success : Colors.danger }]}>
            {valid ? 'Chứng chỉ hợp lệ' : 'Chứng chỉ không hợp lệ'}
          </Text>
          {cert ? (
            <>
              <Text style={styles.info}>{cert.title || 'Chứng chỉ'}</Text>
              <Text style={styles.info}>Mã: {cert.code || cert.id}</Text>
              <Text style={styles.info}>Cấp cho: {cert.user_id}</Text>
              {cert.file_url ? (
                <TouchableOpacity onPress={() => Linking.openURL(cert.file_url)}>
                  <Text style={styles.link}>Mở PDF chứng chỉ</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
          {result.message ? <Text style={styles.info}>{result.message}</Text> : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  input: { backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.base, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center' },
  btnText: { color: Colors.background, fontWeight: '600', fontSize: FontSize.base },
  result: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  valid: { fontSize: FontSize.md, fontWeight: '700' },
  info: { color: Colors.textSecondary, fontSize: FontSize.sm },
  link: { color: Colors.info, marginTop: 4 },
});

export default VerifyCertificateScreen;
