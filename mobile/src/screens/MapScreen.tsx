import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { apiService } from '../services/api';
import { MapPin } from 'lucide-react-native';

export default function MapScreen() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await apiService.get('/map/locations');
        setLocations(response.data || []);
      } catch (err) {
        console.error("Failed to load locations:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, []);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
        <View style={styles.iconContainer}>
           <MapPin size={20} color="#FFD600" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSub}>{item.category || 'Educational Point'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>EduMap PostGIS</Text>
        <Text style={styles.subtitle}>Tìm kiếm tài nguyên học thuật quanh bạn</Text>
      </View>
      
      {loading ? (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#FFD600" />
            <Text style={{ marginTop: 10, color: '#666' }}>Đang nạp dữ liệu địa lý...</Text>
        </View>
      ) : (
        <FlatList
          data={locations}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 20 }}
          ListEmptyComponent={<Text style={styles.empty}>Không tìm thấy địa điểm nào.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#666', marginTop: 5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  iconContainer: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF9C4', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontWeight: 'bold', fontSize: 16 },
  cardSub: { color: '#888', fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' }
});
