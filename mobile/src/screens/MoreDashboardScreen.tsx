import React from 'react';
import { Text, StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { Container } from '../components/ui/Container';
import { Colors, Spacing, FontSize, Radius } from '../theme';
import { MapPin, MessageSquare, Briefcase, GraduationCap, DollarSign, Award, Trophy } from 'lucide-react-native';
import type { ScreenProps } from '../navigation/types';

type Props = ScreenProps<'MoreDashboard'>;

interface Feature {
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  screen?: string; // route within MoreStack
  tab?: 'Home' | 'Map' | 'Career' | 'More'; // switch bottom-tab
}

const features: Feature[] = [
  { label: 'Bản đồ', icon: MapPin, color: Colors.info, tab: 'Map' },
  { label: 'AI Chat', icon: MessageSquare, color: Colors.warning, screen: 'Chat' },
  { label: 'Ngành nghề', icon: Briefcase, color: Colors.primary, tab: 'Career' },
  { label: 'Học bổng', icon: GraduationCap, color: Colors.success, screen: 'ScholarshipList' },
  { label: 'Lab STEM', icon: Award, color: Colors.info, screen: 'StemLabs' },
  { label: 'Thư viện', icon: MessageSquare, color: Colors.primary, screen: 'Library' },
  { label: 'Mentor', icon: Award, color: Colors.danger, screen: 'MentorList' },
  { label: 'Cộng đồng', icon: MessageSquare, color: Colors.primary, screen: 'Community' },
  { label: 'Xanh', icon: Award, color: Colors.success, screen: 'GreenChallenges' },
  { label: 'Game', icon: Trophy, color: Colors.primary, screen: 'Leaderboard' },
  { label: 'Ủng hộ', icon: DollarSign, color: Colors.danger, screen: 'Donate' },
  { label: 'Chứng chỉ', icon: Award, color: Colors.warning, screen: 'CertificatePortfolio' },
  { label: 'Tôi', icon: Trophy, color: Colors.textSecondary, screen: 'Profile' },
];

export const MoreDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const parentNav = navigation.getParent();

  const goTo = (f: Feature) => {
    if (f.tab) {
      parentNav?.navigate(f.tab);
    } else if (f.screen) {
      navigation.navigate(f.screen as any, {});
    }
  };

  return (
    <Container scrollable>
      <Text style={styles.title}>EduMap</Text>
      <Text style={styles.subtitle}>Chọn một tính năng để khám phá</Text>
      <View style={styles.grid}>
        {features.map((f) => (
          <TouchableOpacity key={f.label} style={styles.tile} onPress={() => goTo(f)} activeOpacity={0.8}>
            <View style={[styles.iconWrap, { backgroundColor: `${f.color}22` }]}>
              <f.icon size={28} color={f.color} />
            </View>
            <Text style={styles.tileLabel}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: { width: '30%', alignItems: 'center' },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  tileLabel: { color: Colors.text, fontSize: FontSize.xs, textAlign: 'center' },
});

export default MoreDashboardScreen;
