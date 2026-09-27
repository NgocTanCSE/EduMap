import React from 'react';
import { Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, FontSize } from '../../theme';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'secondary';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'secondary', style }) => {
  const bg = {
    primary: Colors.primary,
    success: Colors.success,
    warning: Colors.warning,
    danger: Colors.danger,
    secondary: Colors.surface,
  }[variant];
  const color = variant === 'secondary' ? Colors.textSecondary : Colors.background;
  return (
    <Text
      style={[styles.badge, { backgroundColor: bg, color }, style]}
      accessible
      accessibilityLabel={label}
    >
      {label}
    </Text>
  );
};

const styles = StyleSheet.create({
  badge: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
});

export default Badge;
