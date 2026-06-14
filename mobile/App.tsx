import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { apiService } from './src/services/api';
import { MapPin, BookOpen, GraduationCap } from 'lucide-react-native';

export default function App() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.getLocations();
      setLocations(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.categoryBadge}>{item.category}</Text>
      </View>
      <View style={styles.cardBody}>
        <MapPin size={14} color="#666" />
        <Text style={styles.addressText} numberOfLines={1}>{item.address}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>EduMap Mobile</Text>
        <Text style={styles.subtitle}>Bản đồ Giáo dục Thông minh Biên Hòa</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, styles.activeTab]}>
          <MapPin size={20} color="#eab308" />
          <Text style={[styles.tabText, styles.activeTabText]}>Bản đồ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <GraduationCap size={20} color="#666" />
          <Text style={styles.tabText}>Cố vấn</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <BookOpen size={20} color="#666" />
          <Text style={styles.tabText}>Thư viện</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#eab308" />
        ) : (
          <FlatList
            data={locations}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshing={loading}
            onRefresh={loadData}
          />
        )}
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#18181b',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    paddingVertical: 10,
    paddingHorizontal: 15,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#27272a',
  },
  activeTab: {
    backgroundColor: '#eab30820',
    borderWidth: 1,
    borderColor: '#eab308',
  },
  tabText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#a1a1aa',
  },
  activeTabText: {
    color: '#eab308',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  listContainer: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 20,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  categoryBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#eab308',
    backgroundColor: '#eab30810',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eab30820',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressText: {
    fontSize: 12,
    color: '#71717a',
  }
});
