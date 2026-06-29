import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { apiService } from '../services/api';
import { MapPin, Wifi } from 'lucide-react-native';

interface WifiLocation {
  id: string;
  name: string;
  address: string;
  speed_mbps?: number;
  is_free?: boolean;
}

export default function WifiScreen() {
  const [locations, setLocations] = useState<WifiLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchWifiLocations();
  }, []);

  const fetchWifiLocations = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/wifi/locations');
      setLocations(data?.data || data || []);
    } catch (err) {
      console.error("Failed to load WiFi locations:", err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWifiLocations();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: WifiLocation }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.iconContainer}>
        <Wifi color="#06b6d4" size={20} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.address}>{item.address}</Text>
        <View style={styles.metaRow}>
          {item.speed_mbps && (
            <Text style={styles.meta}>{item.speed_mbps} Mbps</Text>
          )}
          {item.is_free !== undefined && (
            <Text style={[styles.badge, { backgroundColor: item.is_free ? '#22c55e' : '#ef4444' }]}>
              {item.is_free ? 'Miễn phí' : 'Có phí'}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Địa điểm WiFi</Text>
      <FlatList
        data={locations}
        keyExtractor={(item) => item.id || Math.random().toString()}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={() => (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Không có địa điểm WiFi nào.</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  card: { flexDirection: 'row', backgroundColor: '#18181b', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center' },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#06b6d420', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  address: { color: '#666', fontSize: 12, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  meta: { color: '#666', fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 10, color: '#fff', fontWeight: 'bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#666', fontSize: 14 },
});