import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    try {
      await login({ email, password });
      // navigation.navigate('Main'); // Chuyển hướng sau khi login thành công
    } catch (err: any) {
      Alert.alert('Đăng nhập thất bại', err.message || 'Sai thông tin tài khoản');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>EduMap</Text>
        <Text style={styles.subtitle}>Bản đồ tri thức DNTU</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email sinh viên"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>ĐĂNG NHẬP</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={{ marginTop: 20 }}>
          <Text style={styles.forgot}>Quên mật khẩu?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', padding: 30, borderRadius: 30, elevation: 10, alignItems: 'center' },
  logo: { fontSize: 32, fontWeight: '900', color: '#FFD600' },
  subtitle: { color: '#666', marginBottom: 30 },
  form: { width: '100%', gap: 15 },
  input: { width: '100%', height: 60, backgroundColor: '#f8f8f8', borderRadius: 15, paddingHorizontal: 20, borderWidth: 1, borderColor: '#eee' },
  button: { width: '100%', height: 60, backgroundColor: '#FFD600', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  buttonText: { fontWeight: 'bold', fontSize: 16 },
  forgot: { color: '#888', fontSize: 12 }
});
