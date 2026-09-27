import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { apiService } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'CertificatePortfolio'>;

export const CertificatePortfolioScreen: React.FC<Props> = ({ navigation }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getPortfolio();
      const list = res?.data || res || [];
      setData(Array.isArray(list) ? list : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetch(); }, [fetch]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chứng chỉ của tôi</Text>
      {loading ? <Text style={{ color: Colors.textMuted }}>Đang tải...</Text> : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id || item.code || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có chứng chỉ</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title || 'Chứng chỉ'}</Text>
              <Text style={styles.cardSub}>Mã: {item.code || item.id}</Text>
              <View style={{ marginTop: 4 }}><Badge label={item.expires_at ? 'Có hạn' : 'Không hạn'} variant="secondary" /></View>
              <TouchableOpacity onPress={() => navigation.navigate('VerifyCertificate', { code: item.code || item.id })}>
                <Text style={styles.link}>Xác minh</Text>
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
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: Colors.text, fontWeight: '600' },
  cardSub: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  link: { color: Colors.primary, marginTop: 6, fontSize: FontSize.sm },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
});

export default CertificatePortfolioScreen;
