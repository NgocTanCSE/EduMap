import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { apiService } from '../services/api';
import { MapPin } from 'lucide-react-native';

export default function MapScreen() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await apiService.getLocations();
      setLocations(Array.isArray(data) ? data : data.data || []);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Lỗi tải dữ liệu. Vui lòng thử lại.');
      Alert.alert('Lỗi Kết Nối', error.message || 'Không thể lấy dữ liệu từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.categoryBadge}>{item.category}</Text>
      </View>
      <View style={styles.cardBody}>
        <MapPin size={14} color="#666" />
        <Text style={styles.addressText} numberOfLines={1}>{item.address}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator size="large" color="#eab308" />
      ) : errorMsg ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#ef4444', marginBottom: 10 }}>{errorMsg}</Text>
            <TouchableOpacity onPress={loadData} style={{ padding: 10, backgroundColor: '#eab308', borderRadius: 8 }}>
              <Text style={{ color: '#000', fontWeight: 'bold' }}>Thử lại</Text>
            </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={locations}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={loadData}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 15,
    backgroundColor: '#09090b',
  },
  listContainer: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 20,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#eab308',
    backgroundColor: '#eab30810',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eab30820',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressText: {
    fontSize: 12,
    color: '#71717a',
  }
});
