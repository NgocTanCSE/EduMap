import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';
import { MessageSquare } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'Community'>;

export const CommunityScreen: React.FC<Props> = ({ navigation }) => {
  const [q, setQ] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getPosts({ q });
      const list = res?.data || res || [];
      setData(Array.isArray(list) ? list : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  React.useEffect(() => { fetchPosts(); }, [fetchPosts]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cộng đồng</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreatePost')}>
          <Text style={styles.createText}>+ Tạo bài</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TextInput style={styles.input} placeholder="Tìm bài viết..." value={q} onChangeText={setQ} onSubmitEditing={fetchPosts} placeholderTextColor={Colors.textMuted} />
        <TouchableOpacity onPress={fetchPosts} style={styles.searchBtn}><Text style={styles.searchText}>Tìm</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có bài viết</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('PostDetail', { id: item.id })}>
              <MessageSquare size={20} color={Colors.primary} />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSub} numberOfLines={2}>{item.content}</Text>
              </View>
              <Text style={styles.cardMeta}>{item.likes_count || 0} ♥ · {item.comments_count || 0} 💬</Text>
            </TouchableOpacity>
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
  createBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  createText: { color: Colors.background, fontWeight: '600', fontSize: FontSize.xs },
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  input: { flex: 1, backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  searchBtn: { backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  searchText: { color: Colors.primary, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: Colors.text, fontWeight: '600' },
  cardSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  cardMeta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2, marginLeft: 'auto' },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
});

export default CommunityScreen;
