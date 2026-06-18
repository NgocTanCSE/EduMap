import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { apiService } from '../services/api';
import { Briefcase, Building2, MapPin, DollarSign } from 'lucide-react-native';

export default function InternshipScreen() {
  const [internships, setInternships] = useState<any[]>([]);
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

      const data = await apiService.getInternships(pageNum, 10);
      const items = data.items || data.data || [];
      const meta = data.meta || {};

      if (pageNum === 1) {
        setInternships(items);
      } else {
        setInternships(prev => [...prev, ...items]);
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
        <View style={[styles.statusBadge, item.status === 'open' ? styles.statusOpen : styles.statusClosed]}>
           <Text style={[styles.statusText, item.status === 'open' ? styles.textOpen : styles.textClosed]}>
             {item.status === 'open' ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
           </Text>
        </View>
      </View>
      
      <View style={styles.companyRow}>
        <Building2 size={14} color="#eab308" />
        <Text style={styles.companyText}>{item.company?.full_name || 'Doanh nghiệp ẩn danh'}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <MapPin size={12} color="#a1a1aa" />
          <Text style={styles.infoText}>{item.location ? 'Xem bản đồ' : 'Chưa cập nhật'}</Text>
        </View>
        <View style={styles.infoRow}>
          <DollarSign size={12} color="#a1a1aa" />
          <Text style={styles.infoText}>{item.salary_range || 'Thỏa thuận'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.content}>
      {loading && page === 1 ? (
        <ActivityIndicator size="large" color="#a855f7" />
      ) : errorMsg ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#ef4444', marginBottom: 10 }}>{errorMsg}</Text>
            <TouchableOpacity onPress={() => loadData(1)} style={{ padding: 10, backgroundColor: '#a855f7', borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Thử lại</Text>
            </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={internships}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={() => loadData(1)}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => loadingMore ? <ActivityIndicator size="small" color="#a855f7" style={{ marginVertical: 20 }} /> : null}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Briefcase size={48} color="#3f3f46" />
              <Text style={{ color: '#71717a', marginTop: 10 }}>Không có vị trí thực tập nào.</Text>
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
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
    lineHeight: 22,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusOpen: {
    backgroundColor: '#10b98120',
    borderColor: '#10b98130',
  },
  statusClosed: {
    backgroundColor: '#ef444420',
    borderColor: '#ef444430',
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  textOpen: {
    color: '#34d399',
  },
  textClosed: {
    color: '#f87171',
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  companyText: {
    fontSize: 13,
    color: '#eab308',
    fontWeight: '600',
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
    fontSize: 11,
    color: '#a1a1aa',
  }
});
