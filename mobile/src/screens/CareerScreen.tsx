import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { apiService } from '../services/api';
import { Briefcase, MapPin, Clock } from 'lucide-react-native';

interface CareerOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  deadline?: string;
  type?: string;
}

export default function CareerScreen() {
  const [opportunities, setOpportunities] = useState<CareerOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await apiService.getCareerJobs();
      setOpportunities(data?.data || data || []);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Lỗi tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: CareerOpportunity }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        {item.type && (
          <View style={[styles.typeBadge, { backgroundColor: item.type === 'fulltime' ? '#22c55e' : '#eab308' }]}>
            <Text style={styles.typeText}>{item.type === 'fulltime' ? 'Full-time' : 'Part-time'}</Text>
          </View>
        )}
      </View>
      <Text style={styles.companyText}>{item.company}</Text>
      
      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <MapPin size={14} color="#06b6d4" />
          <Text style={styles.infoText}>{item.location}</Text>
        </View>
        {item.deadline && (
          <View style={styles.infoRow}>
            <Clock size={14} color="#f59e0b" />
            <Text style={styles.infoText}>{new Date(item.deadline).toLocaleDateString()}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#eab308" />
      </View>
    );
  }

  return (
    <View style={styles.content}>
      <Text style={styles.title}>Cơ hội nghề nghiệp</Text>
      {errorMsg ? (
        <View style={styles.center}>
          <Text style={{ color: '#ef4444', marginBottom: 10 }}>{errorMsg}</Text>
          <TouchableOpacity onPress={loadOpportunities} style={{ padding: 10, backgroundColor: '#eab308', borderRadius: 8 }}>
            <Text style={{ color: '#000', fontWeight: 'bold' }}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={opportunities}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Briefcase size={48} color="#3f3f46" />
              <Text style={styles.emptyText}>Chưa có cơ hội việc làm nào.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, backgroundColor: '#09090b', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContainer: { paddingBottom: 20 },
  card: { backgroundColor: '#18181b', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#27272a' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', flex: 1, lineHeight: 22, marginRight: 8 },
  companyText: { fontSize: 12, color: '#818cf8', marginBottom: 12, fontWeight: 'bold' },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 12, color: '#a1a1aa' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  typeText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  emptyText: { color: '#71717a', marginTop: 10 },
});