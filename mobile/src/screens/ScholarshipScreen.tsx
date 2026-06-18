import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { apiService } from '../services/api';
import { GraduationCap, DollarSign, Clock } from 'lucide-react-native';

export default function ScholarshipScreen() {
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadData(1);
  }, []);

  const loadData = async (pageNum: number) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setErrorMsg(null);

      const data = await apiService.getScholarships(pageNum, 10);
      const items = data.items || data.data || [];
      const meta = data.meta || {};

      if (pageNum === 1) {
        setScholarships(items);
      } else {
        setScholarships(prev => [...prev, ...items]);
      }

      setHasMore(meta.currentPage < meta.totalPages);
      setPage(pageNum);
    } catch (error: any) {
      console.error(error);
      if (pageNum === 1) setErrorMsg(error.message || 'Lỗi tải dữ liệu. Vui lòng thử lại.');
      Alert.alert('Lỗi Kết Nối', error.message || 'Không thể lấy dữ liệu từ máy chủ.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadData(page + 1);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      </View>
      <Text style={styles.providerText}>{item.provider || "Tổ chức EduMap"}</Text>
      
      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <DollarSign size={14} color="#10b981" />
          <Text style={styles.infoText}>{Number(item.value_amount).toLocaleString()} USD</Text>
        </View>
        <View style={styles.infoRow}>
          <Clock size={14} color="#f59e0b" />
          <Text style={styles.infoText}>{new Date(item.deadline).toLocaleDateString()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.content}>
      {loading && page === 1 ? (
        <ActivityIndicator size="large" color="#6366f1" />
      ) : errorMsg ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#ef4444', marginBottom: 10 }}>{errorMsg}</Text>
            <TouchableOpacity onPress={() => loadData(1)} style={{ padding: 10, backgroundColor: '#6366f1', borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Thử lại</Text>
            </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={scholarships}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={() => loadData(1)}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => loadingMore ? <ActivityIndicator size="small" color="#6366f1" style={{ marginVertical: 20 }} /> : null}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <GraduationCap size={48} color="#3f3f46" />
              <Text style={{ color: '#71717a', marginTop: 10 }}>Không có học bổng nào.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 15,
    backgroundColor: '#09090b',
  },
  listContainer: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    lineHeight: 22,
  },
  providerText: {
    fontSize: 12,
    color: '#818cf8',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#a1a1aa',
  }
});
