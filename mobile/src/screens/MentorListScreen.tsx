import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';
import { Award } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'MentorList'>;

export const MentorListScreen: React.FC<Props> = ({ navigation, route }) => {
  const [q, setQ] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getMentors({ q, specialty: route.params?.specialty });
      const list = res?.data || res || [];
      setData(Array.isArray(list) ? list : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [q, route.params?.specialty]);

  React.useEffect(() => { fetchList(); }, [fetchList]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mentor</Text>
      <View style={styles.row}>
        <TextInput style={styles.input} placeholder="Tìm theo chuyên môn, tên..." value={q} onChangeText={setQ} onSubmitEditing={fetchList} placeholderTextColor={Colors.textMuted} />
        <TouchableOpacity onPress={fetchList} style={styles.searchBtn}><Text style={styles.searchText}>Tìm</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Không tìm thấy mentor</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('MentorDetail', { id: item.id })}>
              <Award size={22} color={Colors.primary} />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={styles.cardTitle}>{item.full_name || item.name || item.username}</Text>
                <Text style={styles.cardSub}>{item.specialty || item.specialization || ''}</Text>
              </View>
              <Text style={styles.cardMeta}>★ {item.rating || '—'}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  input: { flex: 1, backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  searchBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  searchText: { color: Colors.background, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: Colors.text, fontWeight: '600' },
  cardSub: { color: Colors.textSecondary, fontSize: FontSize.sm },
  cardMeta: { color: Colors.textMuted, fontSize: FontSize.xs },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
});

export default MentorListScreen;
