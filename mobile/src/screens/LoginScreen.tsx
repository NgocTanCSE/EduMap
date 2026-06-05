import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    // Giả lập logic đăng nhập và chuyển hướng
    if (email && password) {
      Alert.alert("Thành công", "Đăng nhập thành công!");
      navigation.navigate('Main');
    } else {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ email và mật khẩu");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EduMap Mobile</Text>
      <Text style={styles.subtitle}>Bản đồ giáo dục thông minh</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email/Username"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.button} onClick={handleLogin}>
          <Text style={styles.buttonText}>ĐĂNG NHẬP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 40 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },
  form: { gap: 15 },
  input: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, fontSize: 16 },
  button: { backgroundColor: '#FFD700', padding: 18, borderRadius: 10, marginTop: 10 },
  buttonText: { textAlign: 'center', fontWeight: 'bold', fontSize: 16, color: '#000' }
});
