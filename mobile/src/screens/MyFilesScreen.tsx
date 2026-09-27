import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'MyFiles'>;

export const MyFilesScreen: React.FC<Props> = ({ navigation }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getMyFiles();
      const list = res?.data || res || [];
      setData(Array.isArray(list) ? list : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { const unsub = navigation.addListener('focus', fetch); return unsub; }, [navigation, fetch]);

  const handleDelete = (id: string) => {
    Alert.alert('Xóa', 'Xóa tệp này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try { await apiService.deleteFile(id); setData((prev) => prev.filter((f) => f.id !== id)); } catch (e: any) { Alert.alert('Lỗi', e?.message || 'Xóa thất bại'); }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tệ tin của tôi</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={() => navigation.navigate('UploadFile')}>
          <Text style={styles.uploadText}>+</Text>
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có tệp</Text>}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.original_name || item.name || item.file_name || 'Tệp'}</Text>
                <Text style={styles.itemSub}>{item.mime_type || item.file_size || ''}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={styles.delete}>Xóa</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  uploadBtn: { backgroundColor: Colors.primary, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  uploadText: { color: Colors.background, fontSize: 20, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  itemTitle: { color: Colors.text, fontWeight: '600' },
  itemSub: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  delete: { color: Colors.danger, fontWeight: '600' },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
});

export default MyFilesScreen;
