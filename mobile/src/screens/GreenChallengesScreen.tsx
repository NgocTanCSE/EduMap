import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import greenService from '../services/green.service';
import { Award } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'GreenChallenges'>;

export const GreenChallengesScreen: React.FC<Props> = ({ navigation }) => {
  const [q, setQ] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await greenService.getChallenges();
      const list = res?.data || res || [];
      const filtered = q.trim() ? list.filter((c: any) => (c.title || '').toLowerCase().includes(q.toLowerCase())) : list;
      setData(Array.isArray(filtered) ? filtered : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  React.useEffect(() => { fetch(); }, [fetch]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thử thách xanh</Text>
      <View style={styles.row}>
        <TextInput style={styles.input} placeholder="Tìm thử thách..." value={q} onChangeText={setQ} placeholderTextColor={Colors.textMuted} />
        <TouchableOpacity onPress={fetch} style={styles.searchBtn}><Text style={styles.searchText}>Tìm</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có thử thách</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('LogActivity', { challengeId: item.id })}>
              <Award size={22} color={Colors.success} />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSub}>{item.description || ''}</Text>
              </View>
              <Text style={styles.cardMeta}>{item.points || 0} pts</Text>
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
  cardSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  cardMeta: { color: Colors.textMuted, fontSize: FontSize.xs, marginLeft: 'auto' },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
});

export default GreenChallengesScreen;
