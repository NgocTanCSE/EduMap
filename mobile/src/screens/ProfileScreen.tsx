import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={{ uri: 'https://ui-avatars.com/api/?name=Tan&background=random' }} 
          style={styles.avatar} 
        />
        <Text style={styles.name}>Ngọc Tân</Text>
        <Text style={styles.role}>Học viên Ưu tú</Text>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Hồ sơ cá nhân</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Cài đặt thông báo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Hỗ trợ & Góp ý</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]}>
          <Text style={[styles.menuText, { color: 'red' }]}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { backgroundColor: '#fff', padding: 40, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 15 },
  name: { fontSize: 22, fontWeight: 'bold' },
  role: { color: '#666', marginTop: 5 },
  menu: { backgroundColor: '#fff', marginTop: 20 },
  menuItem: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  menuText: { fontSize: 16 }
});
