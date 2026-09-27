import React, { useState } from 'react';
import { Text, StyleSheet, View, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize } from '../../theme';
import type { ScreenProps } from '../../navigation/types';

type Props = ScreenProps<'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('nguyenhoangphuc@example.com');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const user = await login({ email, password });
      if (user) {
        navigation.replace('MainTabs');
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EduMap — Đăng nhập</Text>
      <Input label="Email" placeholder="email@edumap.app" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Input label="Mật khẩu" placeholder="••••••" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title="Đăng nhập" variant="primary" fullWidth loading={loading} onPress={handleLogin} />
      <View style={styles.row}>
        <Text style={styles.link} onPress={() => navigation.navigate('Register')}>Chưa có tài khoản? Đăng ký</Text>
        <Text style={styles.link} onPress={() => navigation.navigate('ForgotPassword')}>Quên mật khẩu</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md, justifyContent: 'center' },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700', marginBottom: Spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  link: { color: Colors.primary, fontSize: FontSize.sm },
});

export default LoginScreen;
