import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Colors, Spacing, FontSize } from '../../theme';

export const LoadingSpinner: React.FC<{ size?: number; text?: string }> = ({ size = 32, text }) => {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  );
};

export const ListEmpty: React.FC<{ text?: string }> = ({ text = 'Không có dữ liệu' }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.sm },
  text: { color: Colors.textSecondary, fontSize: FontSize.sm },
  empty: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm },
});

export default LoadingSpinner;
