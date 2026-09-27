import React, { useState } from 'react';
import { Text, StyleSheet, View, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize } from '../../theme';
import type { ScreenProps } from '../../navigation/types';

type Props = ScreenProps<'TwoFactor'>;

export const TwoFactorScreen: React.FC<Props> = ({ navigation }) => {
  const { verifyTwoFactor } = useAuth();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!token) return Alert.alert('Lỗi', 'Nhập mã xác thực 6 số');
    setLoading(true);
    try {
      await verifyTwoFactor(token);
      navigation.replace('MainTabs');
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Mã không hợp lệ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Xác thực 2 bước (TOTP)</Text>
      <Text style={styles.hint}>Nhập mã 6 số từ ứng dụng xác thực (Google Authenticator / Authy).</Text>
      <Input
        label="Mã xác thực"
        placeholder="000000"
        value={token}
        onChangeText={setToken}
        keyboardType="numeric"
        secureTextEntry
      />
      <Button title="Xác nhận" variant="primary" fullWidth loading={loading} onPress={handleVerify} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md, justifyContent: 'center' },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700', marginBottom: Spacing.lg },
  hint: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.md },
});

export default TwoFactorScreen;
