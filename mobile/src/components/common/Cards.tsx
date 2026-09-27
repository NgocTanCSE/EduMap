import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, FontSize } from '../../theme';

// Lightweight presentational cards reused across feature screens.
export const StatCard: React.FC<{ label: string; value: string | number; icon?: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <View style={styles.stat}>
    {icon}
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const ResourceCard: React.FC<{
  title: string;
  subtitle?: string;
  type?: string;
  onPress: () => void;
}> = ({ title, subtitle, type, onPress }) => (
  <View style={styles.item}>
    <View style={{ flex: 1 }}>
      <Text style={styles.itemTitle}>{title}</Text>
      {subtitle ? <Text style={styles.itemSub}>{subtitle}</Text> : null}
      {type ? <Text style={styles.itemType}>{type}</Text> : null}
    </View>
    <Text style={styles.itemLink} onPress={onPress}>Chi tiết</Text>
  </View>
);

export const MentorCard: React.FC<{
  name: string;
  specialty: string;
  rating?: number;
  avatar?: string;
  onPress: () => void;
}> = ({ name, specialty, rating, avatar, onPress }) => (
  <View style={styles.card}>
    {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : null}
    <View style={{ flex: 1 }}>
      <Text style={styles.itemTitle}>{name}</Text>
      <Text style={styles.itemSub}>{specialty}</Text>
      {rating ? <Text style={styles.itemType}>★ {rating}</Text> : null}
    </View>
    <Text style={styles.itemLink} onPress={onPress}>Đặt lịch</Text>
  </View>
);

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 4,
    minHeight: 96,
  },
  statValue: { color: Colors.primary, fontSize: FontSize.lg, fontWeight: '700' },
  statLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemTitle: { color: Colors.text, fontSize: FontSize.base, fontWeight: '600' },
  itemSub: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  itemType: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  itemLink: { color: Colors.primary, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
});
