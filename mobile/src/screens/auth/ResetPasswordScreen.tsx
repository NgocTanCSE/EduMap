import React, { useState } from 'react';
import { Text, StyleSheet, View, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize } from '../../theme';
import type { ScreenProps } from '../../navigation/types';

type Props = ScreenProps<'ResetPassword'>;

export const ResetPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { resetPassword } = useAuth();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!token || !password) return Alert.alert('Lỗi', 'Nhập token và mật khẩu mới');
    setLoading(true);
    try {
      await resetPassword(token, password);
      Alert.alert('Thành công', 'Đặt lại mật khẩu thành công. Đăng nhập lại.', [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Đặt lại thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đặt lại mật khẩu</Text>
      <Input label="Token xác minh (từ email)" placeholder="token..." value={token} onChangeText={setToken} />
      <Input label="Mật khẩu mới" placeholder="••••••" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title="Xác nhận" variant="primary" fullWidth loading={loading} onPress={handleReset} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md, justifyContent: 'center' },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700', marginBottom: Spacing.lg },
});

export default ResetPasswordScreen;
