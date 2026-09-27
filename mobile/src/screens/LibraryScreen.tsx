import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';
import { MessageSquare } from 'lucide-react-native';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'Library'>;

interface LibraryResource {
  id: string;
  title: string;
  author?: string;
  category?: string;
  type?: string;
  file_url?: string;
  description?: string;
}

export const LibraryScreen: React.FC<Props> = ({ navigation, route }) => {
  const [query, setQuery] = useState(route.params?.query || '');
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(true);

  const loadResources = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getLibrary({ q: query, limit: 20 });
      const list = data?.data || data || [];
      setResources(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  React.useEffect(() => {
    loadResources();
  }, [loadResources]);

  const renderItem = ({ item }: { item: LibraryResource }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ResourceDetail', { id: item.id })}
    >
      <View style={styles.iconContainer}>
        <MessageSquare color={Colors.primary} size={20} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {item.author ? <Text style={styles.author}>{item.author}</Text> : null}
        {item.category ? <Text style={styles.category}>{item.category}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm tài liệu..."
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={loadResources}
        />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={resources}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={renderItem}
          ListEmptyComponent={() => <View style={styles.center}><Text style={styles.emptyText}>Không tìm thấy tài liệu nào.</Text></View>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16 },
  searchContainer: { marginBottom: 16 },
  searchInput: { backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 16, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.primary}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
  author: { color: Colors.primary, fontSize: 11, marginTop: 2 },
  category: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  emptyText: { color: Colors.textMuted },
});

export default LibraryScreen;
