import React, { useState } from 'react';
import { Text, StyleSheet, View, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Colors, Spacing, FontSize } from '../../theme';
import type { ScreenProps } from '../../navigation/types';

type Props = ScreenProps<'Register'>;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { register } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!form.email || !form.password || !form.full_name) {
      return Alert.alert('Lỗi', 'Vui lòng nhập email, mật khẩu và họ tên');
    }
    setLoading(true);
    try {
      await register(form);
      Alert.alert('Thành công', 'Đăng ký thành công. Vui lòng đăng nhập.', [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đăng ký tài khoản</Text>
      <Input label="Email" placeholder="email@edumap.app" value={form.email} onChangeText={(e) => setForm({ ...form, email: e })} autoCapitalize="none" />
      <Input label="Họ tên" placeholder="Nguyễn Văn A" value={form.full_name} onChangeText={(e) => setForm({ ...form, full_name: e })} />
      <Input label="Mật khẩu" placeholder="••••••" secureTextEntry value={form.password} onChangeText={(e) => setForm({ ...form, password: e })} />
      <Input label="SĐT (tùy chọn)" placeholder="0909xxxxxx" value={form.phone} onChangeText={(e) => setForm({ ...form, phone: e })} />
      <Button title="Đăng ký" variant="primary" fullWidth loading={loading} onPress={handleRegister} />
      <Text style={styles.link} onPress={() => navigation.replace('Login')}>Đã có tài khoản? Đăng nhập</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md, justifyContent: 'center' },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700', marginBottom: Spacing.lg },
  link: { color: Colors.primary, fontSize: FontSize.sm, marginTop: Spacing.md },
});

export default RegisterScreen;
