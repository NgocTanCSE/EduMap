import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import donateService from '../services/donate.service';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'Donate'>;

export const DonateScreen: React.FC<Props> = ({ navigation }) => {
  const [q, setQ] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [donateOpen, setDonateOpen] = useState(false);
  const [amount, setAmount] = useState('');

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await donateService.getCampaigns({ q });
      const list = res?.data || res || [];
      setData(Array.isArray(list) ? list : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  React.useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handlePay = async () => {
    if (!amount) return Alert.alert('Lỗi', 'Nhập số tiền');
    setDonateOpen(true);
    try {
      await donateService.payViaVnPay({ amount: Number(amount), description: 'Ủng hộ EduMap' });
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không tạo được thanh toán');
    } finally {
      setDonateOpen(false);
    }
  };

  const CampaignCard: React.FC<{ item: any }> = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CampaignDetail', { id: item.id })}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSub}>Mục tiêu: {item.target_amount ? `$${item.target_amount}` : ''} · Đã có: {item.current_amount ? `$${item.current_amount}` : ''}</Text>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: item.target_amount ? `${Math.min((item.current_amount / item.target_amount) * 100, 100)}%` : '0%' }]} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quyên góp xã hội</Text>
      <View style={styles.row}>
        <TextInput style={styles.input} placeholder="Tìm chiến dịch..." value={q} onChangeText={setQ} onSubmitEditing={fetchCampaigns} placeholderTextColor={Colors.textMuted} />
        <TouchableOpacity onPress={fetchCampaigns} style={styles.searchBtn}><Text style={styles.searchText}>Tìm</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item.id || `${i}`}
          ListEmptyComponent={<Text style={styles.empty}>Chưa có chiến dịch</Text>}
          renderItem={({ item }) => <CampaignCard item={item} />}
        />
      )}
      <View style={styles.donateBar}>
        <TextInput style={styles.amountInput} placeholder="Số tiền (VNĐ)" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholderTextColor={Colors.textMuted} />
        <TouchableOpacity style={styles.payBtn} onPress={handlePay} disabled={donateOpen}>
          <Text style={styles.payText}>{donateOpen ? 'Mở...' : 'Quyên góp'}</Text>
        </TouchableOpacity>
      </View>
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
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { color: Colors.text, fontWeight: '600' },
  cardSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  progress: { backgroundColor: Colors.card, borderRadius: Radius.full, height: 6, marginTop: 8, overflow: 'hidden' },
  progressFill: { backgroundColor: Colors.success, height: 6, borderRadius: 3 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  donateBar: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  amountInput: { flex: 1, backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  payBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  payText: { color: Colors.background, fontWeight: '600' },
});

export default DonateScreen;
