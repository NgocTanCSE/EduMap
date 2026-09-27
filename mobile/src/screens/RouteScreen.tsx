import React, { useState } from 'react';
import { Text, View, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';
import { MapPin, Route } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'RouteScreen'>;

export const RouteScreen: React.FC<Props> = ({ navigation, route }) => {
  const [origin, setOrigin] = useState(route.params?.origin || '');
  const [destination, setDestination] = useState(route.params?.destination || '');
  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<any>(null);

  const handleFind = async () => {
    if (!origin || !destination) return Alert.alert('Lỗi', 'Vui lòng nhập điểm xuất phát và đến');
    setLoading(true);
    try {
      const res = await apiService.getRoute({ origin, destination });
      setRouteResult(res);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không tìm thấy lộ trình');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <MapPin size={18} color={Colors.primary} />
        <TextInput
          style={styles.input}
          placeholder="lat,lng (xuất phát)"
          value={origin}
          onChangeText={setOrigin}
          placeholderTextColor={Colors.textMuted}
        />
      </View>
      <View style={styles.row}>
        <Route size={18} color={Colors.danger} />
        <TextInput
          style={styles.input}
          placeholder="lat,lng (đến)"
          value={destination}
          onChangeText={setDestination}
          placeholderTextColor={Colors.textMuted}
        />
      </View>
      <TouchableOpacity style={styles.findBtn} onPress={handleFind} disabled={loading}>
        {loading ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.findText}>Tìm đường</Text>}
      </TouchableOpacity>

      {routeResult && (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>Khoảng cách & thời gian</Text>
          <Text style={styles.resultText}>Quãng đường: {routeResult.distance ?? '...'} km</Text>
          <Text style={styles.resultText}>Thời gian: {routeResult.duration ?? '...'} phút</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.sm },
  input: { flex: 1, color: Colors.text, paddingVertical: Spacing.sm, fontSize: FontSize.base },
  findBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center' },
  findText: { color: Colors.background, fontWeight: '600', fontSize: FontSize.base },
  result: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  resultTitle: { color: Colors.text, fontWeight: '700', marginBottom: 4 },
  resultText: { color: Colors.textSecondary, fontSize: FontSize.sm },
});

export default RouteScreen;
