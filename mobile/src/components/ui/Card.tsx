import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Radius, Spacing, FontSize, Shadows } from '../../theme';

export interface CardProps {
  header?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  headerRight?: React.ReactNode;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ header, children, style, headerRight, onPress }) => {
  return (
    <View style={[styles.card, Shadows.card, style]}>
      {header ? (
        <View style={styles.header}>
          <Text style={styles.headerText}>{header}</Text>
          {headerRight}
        </View>
      ) : null}
      {children}
    </View>
  );
};

export const CardSub: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <View style={styles.subrow}>
    <Text style={styles.subLabel}>{label}</Text>
    <Text style={styles.subValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  subrow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  subLabel: { color: Colors.textSecondary, fontSize: FontSize.sm },
  subValue: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
});

export default Card;
