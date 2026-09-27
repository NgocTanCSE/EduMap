import React from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAsync } from '../hooks/useAsync';
import { apiService } from '../services/api';
import { MapPin, Send } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'LocationDetail'>;

export const LocationDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { id, name, category, address, lat, lng } = route.params || {};
  const { data, loading, error } = useAsync(() => apiService.get(`/map/locations`));
  const list = data as any[] | undefined;
  const item = list?.find((l) => l.id === id) || { id, name, category, address, lat, lng };

  const point = {
    latitude: item?.lat ?? item?.location?.lat ?? 10.77,
    longitude: item?.lng ?? item?.location?.lng ?? 106.66,
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <MapView provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill} region={{ ...point, latitudeDelta: 0.01, longitudeDelta: 0.01 }}>
          <Marker coordinate={point} title={item?.name} description={item?.address} pinColor={Colors.primary} />
        </MapView>
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{item?.name || 'Địa điểm'}</Text>
        <Text style={styles.meta}>{item?.category || category}</Text>
        <View style={styles.row}>
          <MapPin size={14} color={Colors.textMuted} />
          <Text style={styles.address}>{item?.address || address || 'Chưa có địa chỉ'}</Text>
        </View>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.navigate('RouteScreen', { origin: `${point.latitude},${point.longitude}`, destination: undefined })}
        >
          <Send size={16} color={Colors.background} />
          <Text style={styles.btnText}>Đường đi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.sm },
  mapWrap: { width: '100%', height: 220, borderRadius: Radius.md, overflow: 'hidden', marginBottom: Spacing.sm },
  info: { gap: 6 },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  meta: { color: Colors.textSecondary, fontSize: FontSize.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  address: { color: Colors.textMuted, fontSize: FontSize.sm },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignSelf: 'flex-start', marginTop: Spacing.sm },
  btnText: { color: Colors.background, fontWeight: '600' },
});

export default LocationDetailScreen;
