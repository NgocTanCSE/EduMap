import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import { LogOut, Settings, Shield, FileText, CreditCard, Key } from 'lucide-react-native';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'Profile'>;

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout, getProfile, twoFactorEnabled } = useAuth();

  useEffect(() => {
    getProfile().catch(() => {});
  }, []);

  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const menu: { label: string; icon: React.ComponentType<any>; route?: keyof typeof Routes }[] = [
    { label: 'Cập nhật hồ sơ', icon: Settings, route: 'UpdateProfile' },
    { label: 'Đổi mật khẩu', icon: Key, route: 'ChangePassword' },
    { label: 'Xác thực 2FA', icon: Shield, route: undefined },
    { label: 'Tệ tin của tôi', icon: FileText, route: 'MyFiles' },
    { label: 'Chứng chỉ', icon: CreditCard, route: 'CertificatePortfolio' },
    { label: 'Xác minh chứng chỉ', icon: CreditCard, route: 'VerifyCertificate' },
  ];

  const Routes = { UpdateProfile: 'UpdateProfile', ChangePassword: 'ChangePassword', MyFiles: 'MyFiles', CertificatePortfolio: 'CertificatePortfolio', VerifyCertificate: 'VerifyCertificate' };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar uri={user?.fullName ? undefined : undefined} size={80} />
        <Text style={styles.name}>{user?.fullName || user?.email || 'Ẩn danh'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>{user?.role ? `Vai trò: ${user.role}` : twoFactorEnabled ? 'Bảo mật 2FA đã bật' : ''}</Text>
      </View>

      <View style={styles.menu}>
        {menu.map((m) => (
          <TouchableOpacity
            key={m.label}
            style={styles.menuItem}
            onPress={() => (m.route ? navigation.navigate(m.route) : undefined)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <m.icon size={18} color={Colors.textSecondary} />
              <Text style={styles.menuText}>{m.label}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <LogOut size={18} color={Colors.danger} />
          <Text style={[styles.menuText, { color: Colors.danger }]}>Đăng xuất</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.md, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  name: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginTop: 8 },
  email: { color: Colors.textSecondary, fontSize: FontSize.sm },
  role: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  menu: { backgroundColor: Colors.surface, marginTop: Spacing.sm, marginHorizontal: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  menuItem: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuText: { fontSize: FontSize.base, color: Colors.text },
});

export default ProfileScreen;
