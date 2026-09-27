import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { apiService } from '../services/api';
import { MapPin } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'MapList'>;

type POI = {
  id: string;
  name: string;
  category: string;
  address: string;
  location?: { lat: number; lng: number };
  lat?: number;
  lng?: number;
};

type Tab = 'list' | 'map';

export const MapScreen: React.FC<Props> = ({ navigation }) => {
  const [locations, setLocations] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('list');

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await apiService.getLocations();
      setLocations(Array.isArray(data) ? data : data?.data || []);
    } catch (error: any) {
      setErrorMsg(error?.message || 'Lỗi tải dữ liệu. Vui lòng thử lại.');
      Alert.alert('Lỗi Kết Nối', error?.message || 'Không thể lấy dữ liệu từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const coord = (item: POI) => ({
    latitude: item.lat ?? item.location?.lat ?? 10.77,
    longitude: item.lng ?? item.location?.lng ?? 106.66,
  });

  const renderItem = ({ item }: { item: POI }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('LocationDetail', { id: item.id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.categoryBadge}>{item.category}</Text>
      </View>
      <View style={styles.cardBody}>
        <MapPin size={14} color={Colors.textMuted} />
        <Text style={styles.addressText} numberOfLines={1}>
          {item.address}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const windowHeight = Dimensions.get('window').height;

  return (
    <View style={styles.content}>
      <View style={styles.tabBar}>
        <TabButton label="Danh sách" active={tab === 'list'} onPress={() => setTab('list')} />
        <TabButton label="Bản đồ" active={tab === 'map'} onPress={() => setTab('map')} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : errorMsg ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: Colors.danger, marginBottom: 10 }}>{errorMsg}</Text>
          <TouchableOpacity onPress={loadData} style={{ padding: 10, backgroundColor: Colors.primary, borderRadius: 8 }}>
            <Text style={{ color: '#000', fontWeight: 'bold' }}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : tab === 'map' ? (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1, height: windowHeight - 160 }}
          initialRegion={{
            latitude: locations.length ? coord(locations[0]).latitude : 10.77,
            longitude: locations.length ? coord(locations[0]).longitude : 106.66,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation
        >
          {locations.map((item) => (
            <Marker
              key={item.id}
              coordinate={coord(item)}
              title={item.name}
              description={item.address}
              pinColor={Colors.primary}
            />
          ))}
        </MapView>
      ) : (
        <FlatList
          data={locations}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={loadData}
          ListEmptyComponent={<Text style={{ color: Colors.textMuted, textAlign: 'center' }}>Chưa có dữ liệu</Text>}
        />
      )}
    </View>
  );
};

const TabButton: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.tabBtn, { backgroundColor: active ? Colors.primary : Colors.surface, borderColor: Colors.border }]}
    onPress={onPress}
  >
    <Text style={[styles.tabBtnText, { color: active ? Colors.background : Colors.textSecondary }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  content: { flex: 1, padding: Spacing.sm, backgroundColor: Colors.background },
  tabBar: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center' },
  tabBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  listContainer: { paddingBottom: 20 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, flex: 1, marginRight: 10 },
  categoryBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${Colors.primary}20`,
  },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressText: { fontSize: 12, color: Colors.textMuted },
});

export default MapScreen;
