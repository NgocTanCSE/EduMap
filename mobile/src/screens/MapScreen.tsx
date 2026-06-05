import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.placeholderText}>Bản đồ Cơ hội thông minh</Text>
        <Text style={styles.subText}>Đang tải dữ liệu PostGIS...</Text>
      </View>
      
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Tìm kiếm cơ hội</Text>
        <View style={styles.filterRow}>
          <View style={styles.filterBadge}><Text style={styles.filterText}>Học bổng</Text></View>
          <View style={styles.filterBadge}><Text style={styles.filterText}>Thực tập</Text></View>
          <View style={styles.filterBadge}><Text style={styles.filterText}>Wifi</Text></View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapPlaceholder: { flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  subText: { color: '#666', fontSize: 12, marginTop: 10 },
  overlay: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#fff', padding: 20, borderRadius: 25, elevation: 5 },
  overlayTitle: { fontWeight: 'bold', marginBottom: 15 },
  filterRow: { flexDirection: 'row', gap: 10 },
  filterBadge: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#f0f0f0', borderRadius: 20 },
  filterText: { fontSize: 12, color: '#333' }
});
