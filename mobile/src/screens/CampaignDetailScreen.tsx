import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import donateService from '../services/donate.service';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'CampaignDetail'>;

export const CampaignDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const [campaign, setCampaign] = useState<any>(null);
  const [donors, setDonors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const [c, d] = await Promise.all([donateService.getCampaign(id), donateService.getDonors(id)]);
      setCampaign(c?.data || c);
      setDonors(d?.data || d || []);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không tải được chiến dịch');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetch(); }, [id]);

  const handlePay = async () => {
    if (!amount) return Alert.alert('Lỗi', 'Nhập số tiền');
    setPaying(true);
    try {
      await donateService.payViaVnPay({ amount: Number(amount), campaignId: id, description: campaign?.title });
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không tạo thanh toán');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <ActivityIndicator color={Colors.primary} style={{ flex: 1, marginTop: 40 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{campaign?.title || 'Chiến dịch'}</Text>
      <Text style={styles.body}>{campaign?.description || 'Chưa có mô tả'}</Text>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: campaign?.target_amount ? `${Math.min((campaign?.current_amount / campaign?.target_amount) * 100, 100)}%` : '0%' }]} />
      </View>
      <Text style={styles.meta}>Đã góp: ${campaign?.current_amount || 0} / ${campaign?.target_amount || 0}</Text>

      <View style={styles.donateBar}>
        <TextInput style={styles.amountInput} placeholder="Số tiền quyên góp" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholderTextColor={Colors.textMuted} />
        <TouchableOpacity style={styles.payBtn} onPress={handlePay} disabled={paying}>
          <Text style={styles.payText}>{paying ? 'Mở...' : 'Ứng hỗ VNPay'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Danh sách ủng hộ</Text>
      <FlatList
        data={donors}
        keyExtractor={(item, i) => item.id || `${i}`}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có người ủng hộ</Text>}
        renderItem={({ item }) => <View style={styles.donor}><Text style={styles.donorName}>{item.name || item.user_id || 'Ẩn danh'}</Text><Text style={styles.donorAmount}>${item.amount}</Text></View>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.md },
  body: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.md },
  progress: { backgroundColor: Colors.card, borderRadius: Radius.full, height: 8, marginTop: Spacing.sm, overflow: 'hidden' },
  progressFill: { backgroundColor: Colors.success, height: 8, borderRadius: 4 },
  meta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 4, marginBottom: Spacing.md },
  sectionTitle: { color: Colors.text, fontWeight: '700', marginTop: Spacing.md, marginBottom: Spacing.sm },
  donateBar: { flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.md },
  amountInput: { flex: 1, backgroundColor: Colors.surface, color: Colors.text, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.base, borderWidth: 1, borderColor: Colors.border },
  payBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  payText: { color: Colors.background, fontWeight: '600' },
  donor: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  donorName: { color: Colors.text },
  donorAmount: { color: Colors.primary, fontWeight: '600' },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 20 },
});

export default CampaignDetailScreen;
