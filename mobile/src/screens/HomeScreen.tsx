import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { StatCard } from '../components/common/Cards';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import { MapPin, GraduationCap, Briefcase, Award, Trophy, MessageSquare } from 'lucide-react-native';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiService.get('/ai/analytics/stats');
        setStats(data);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const greetingName = user?.fullName || 'Sinh viên';

  const quick = [
    { label: 'AI Chat', tab: 'More' as const, icon: MessageSquare },
    { label: 'Bản đồ', tab: 'Map' as const, icon: MapPin },
    { label: 'Ngành nghề', tab: 'Career' as const, icon: Briefcase },
    { label: 'Học bổng', tab: 'More' as const, icon: GraduationCap },
    { label: 'Mentor', tab: 'More' as const, icon: Award },
    { label: 'Cộng đồng', tab: 'More' as const, icon: Trophy },
  ];

  const parentNav = navigation.getParent();
  const switchTab = (tab: 'Home' | 'Map' | 'Career' | 'More') => {
    parentNav?.navigate(tab);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Xin chào, {greetingName}!</Text>
        <Text style={styles.subtitle}>Chào mừng bạn quay lại hệ thống EduMap.</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#FFF9C4' }]}>
          <Text style={styles.statLabel}>Dự đoán AI</Text>
          <Text style={statsCardValue}>{stats?.data?.total_predictions || 0}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
          <Text style={styles.statLabel}>Độ chính xác</Text>
          <Text style={statsCardValue}>
            {stats?.data?.accuracy_rate ? `${Math.round(stats.data.accuracy_rate * 100)}%` : '0%'}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
          <Text style={styles.statLabel}>Học bổng</Text>
          <Text style={statsCardValue}>84</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FDE2F3' }]}>
          <Text style={styles.statLabel}>Mentor</Text>
          <Text style={statsCardValue}>42</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
      <View style={styles.grid}>
        {quick.map((q) => (
          <TouchableOpacity key={q.label} style={styles.tile} onPress={() => switchTab(q.tab)}>
            <View style={[styles.tileIcon, { backgroundColor: `${Colors.primary}22` }]}>
              <q.icon size={22} color={Colors.primary} />
            </View>
            <Text style={styles.tileLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Bản đề xuất cho bạn</Text>
      {loading ? (
        <LoadingSpinner text="Tải thống kê..." />
      ) : (
        <TouchableOpacity style={styles.featuredCard} onPress={() => switchTab('More')}>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Khám phá thử thách xanh & cộng đồng</Text>
            <Text style={styles.cardDesc}>Tham gia hoạt động bền vững và kết nối với các mentor.</Text>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const statsCardValue = { fontSize: 20, fontWeight: 'bold', marginTop: 5, color: '#09090b' } as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.md, paddingTop: 56 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: Colors.text },
  subtitle: { color: Colors.textSecondary, marginTop: 5 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.md },
  statCard: { width: '46%', padding: 15, borderRadius: 15 },
  statLabel: { fontSize: 12, color: '#666' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, paddingHorizontal: Spacing.md, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.md },
  tile: { width: '30%', alignItems: 'center' },
  tileIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  featuredCard: { marginHorizontal: Spacing.md, borderRadius: 20, backgroundColor: Colors.surface, overflow: 'hidden', marginBottom: Spacing.xl },
  cardContent: { padding: 15 },
  cardTitle: { fontWeight: 'bold', fontSize: 16, color: Colors.text },
  cardDesc: { color: Colors.textSecondary, fontSize: 12, marginTop: 5 },
});

export default HomeScreen;
