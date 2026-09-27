import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAsync } from '../hooks/useAsync';
import { apiService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Avatar } from '../components/ui/Avatar';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'MentorDetail'>;

export const MentorDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { id } = route.params;
  const detail = useAsync(() => apiService.getMentor(id));
  const slots = useAsync(() => apiService.getMentorSlots(id));

  const mentor = detail.data?.data || detail.data || {};
  const available: any[] = slots.data?.data || slots.data || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md }}>
      {detail.loading ? (
        <LoadingSpinner text="Đang tải..." />
      ) : (
        <>
          <View style={styles.head}>
            <Avatar uri={mentor.avatar_url} size={80} />
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={styles.name}>{mentor.full_name || mentor.name || 'Mentor'}</Text>
              <Text style={styles.specialty}>{mentor.specialty || mentor.specialization || ''}</Text>
              <Text style={styles.rating}>★ {mentor.rating || '—'} · {mentor.hourly_rate ? `$${mentor.hourly_rate}/h` : ''}</Text>
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tiểu sử</Text>
            <Text style={styles.body}>{mentor.bio || 'Chưa có tiểu sử'}</Text>
            <Text style={styles.body}>{mentor.experience || ''}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lịch rảnh</Text>
            {slots.loading ? <LoadingSpinner text="Đang tải lịch..." /> : available.length === 0 ? (
              <Text style={styles.empty}>Hiện không có khung giờ rảnh</Text>
            ) : (
              <View>
                {available.map((s, i) => (
                  <TouchableOpacity
                    key={s.start || i}
                    style={styles.slot}
                    onPress={() => navigation.navigate('BookMentor', { mentorId: id })}
                  >
                    <Text style={styles.slotText}>{s.start} → {s.end || s.end_time}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('BookMentor', { mentorId: id })}>
            <Text style={styles.btnText}>Đặt lịch với mentor</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  head: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  name: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  specialty: { color: Colors.textSecondary, fontSize: FontSize.sm },
  rating: { color: Colors.textMuted, fontSize: FontSize.xs },
  section: { paddingHorizontal: Spacing.md, marginTop: Spacing.sm },
  sectionTitle: { color: Colors.text, fontWeight: '700', marginBottom: 6 },
  body: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  slot: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  slotText: { color: Colors.text, fontSize: FontSize.sm },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.full, padding: Spacing.sm, alignItems: 'center', margin: Spacing.md, marginTop: 0 },
  btnText: { color: Colors.background, fontWeight: '600', fontSize: FontSize.base },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 20 },
});

export default MentorDetailScreen;
