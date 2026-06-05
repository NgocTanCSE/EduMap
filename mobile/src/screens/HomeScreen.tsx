import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Xin chào, Tân! 👋</Text>
        <Text style={styles.subtitle}>Bạn đã tiết kiệm được 12.5kg CO2 tuần này.</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#E8F5E9' }]}>
          <Text style={styles.statLabel}>Level</Text>
          <Text style={styles.statValue}>24</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#E3F2FD' }]}>
          <Text style={styles.statLabel}>Points</Text>
          <Text style={styles.statValue}>1,540</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Hoạt động nổi bật</Text>
      <TouchableOpacity style={styles.featuredCard}>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=400' }} 
          style={styles.cardImage} 
        />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Dọn rác bãi biển Vũng Tàu</Text>
          <Text style={styles.cardDesc}>Nhận ngay 100 điểm và huy hiệu Tình nguyện.</Text>
        </View>
      </TouchableOpacity>
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
