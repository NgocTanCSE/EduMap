import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { apiService } from '../services/api';
import { Book, Search, Download } from 'lucide-react-native';

interface LibraryResource {
  id: string;
  title: string;
  author: string;
  category: string;
  file_url?: string;
}

export default function LibraryScreen() {
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      setLoading(true);
      const data = await apiService.getLibrary();
      setResources(data?.data || data || []);
    } catch (err) {
      console.error("Failed to load library resources:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredResources = resources.filter(r =>
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.author?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: LibraryResource }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.iconContainer}>
        <Book color="#8b5cf6" size={20} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.author}>{item.author}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.category}>{item.category}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm tài liệu..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      ) : (
        <FlatList
          data={filteredResources}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={renderItem}
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Không tìm thấy tài liệu nào.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', padding: 16 },
  searchContainer: { marginBottom: 16 },
  searchInput: { backgroundColor: '#18181b', borderRadius: 12, padding: 12, color: '#fff', borderWidth: 1, borderColor: '#27272a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', backgroundColor: '#18181b', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center' },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8b5cf620', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  author: { color: '#818cf8', fontSize: 11, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  category: { color: '#666', fontSize: 11 },
  emptyText: { color: '#71717a' },
});