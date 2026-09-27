import React, { useState } from 'react';
import { Text, StyleSheet, View, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize } from '../../theme';
import type { ScreenProps } from '../../navigation/types';

type Props = ScreenProps<'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) return Alert.alert('Lỗi', 'Nhập email');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      Alert.alert('Thành công', 'Link đặt lại mật khẩu đã gửi tới email. Vui lòng kiểm tra và nhập token xác minh.');
      navigation.navigate('ResetPassword', { email });
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Gửi mail thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quên mật khẩu</Text>
      <Input label="Email" placeholder="email@edumap.app" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Button title="Gửi link đặt lại" variant="primary" fullWidth loading={loading} onPress={handleReset} />
      <Text style={styles.link} onPress={() => navigation.replace('Login')}>Quay lại đăng nhập</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md, justifyContent: 'center' },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700', marginBottom: Spacing.lg },
  link: { color: Colors.primary, fontSize: FontSize.sm, marginTop: Spacing.md },
});

export default ForgotPasswordScreen;
