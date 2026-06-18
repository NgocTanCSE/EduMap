import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';

export default function HomeScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiService.get('/ai/analytics/stats');
        setStats(data);
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Xin chào, {user?.full_name || 'Sinh viên'}! 👋</Text>
        <Text style={styles.subtitle}>Chào mừng bạn quay lại hệ thống EduMap DNTU.</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#FFF9C4' }]}>
          <Text style={styles.statLabel}>Dự đoán AI</Text>
          <Text style={styles.statValue}>{stats?.data?.total_predictions || 0}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
          <Text style={styles.statLabel}>Độ chính xác</Text>
          <Text style={styles.statValue}>{(stats?.data?.accuracy_rate * 100).toFixed(0) || 0}%</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Tài nguyên dành cho bạn</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#FFD600" />
      ) : (
        <TouchableOpacity style={styles.featuredCard}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=400' }} 
            style={styles.cardImage} 
          />
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Khám phá bản đồ tri thức</Text>
            <Text style={styles.cardDesc}>Xem các địa điểm học tập và Wifi miễn phí xung quanh DNTU.</Text>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 20, paddingTop: 60 },
  greeting: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#666', marginTop: 5 },
  statsRow: { flexDirection: 'row', padding: 20, justifyContent: 'space-between' },
  statCard: { width: '48%', padding: 15, borderRadius: 15 },
  statLabel: { fontSize: 12, color: '#666' },
  statValue: { fontSize: 20, fontWeight: 'bold', marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 15 },
  featuredCard: { marginHorizontal: 20, borderRadius: 20, backgroundColor: '#f5f5f5', overflow: 'hidden' },
  cardImage: { width: '100%', height: 150 },
  cardContent: { padding: 15 },
  cardTitle: { fontWeight: 'bold', fontSize: 16 },
  cardDesc: { color: '#666', fontSize: 12, marginTop: 5 },
});
