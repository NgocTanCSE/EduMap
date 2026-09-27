import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  GestureResponderEvent,
  ActivityIndicator,
  View,
} from 'react-native';
import { Colors, Radius, Spacing, FontSize } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

export interface ButtonProps {
  title: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
  titleStyle?: object;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  icon,
  titleStyle,
}) => {
  const variantStyle = {
    primary: { backgroundColor: Colors.primary, borderRadius: Radius.md },
    secondary: { backgroundColor: Colors.surface, borderRadius: Radius.md },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: Radius.md,
    },
    ghost: { backgroundColor: 'transparent', borderRadius: Radius.md },
    danger: { backgroundColor: Colors.danger, borderRadius: Radius.md },
  }[variant];

  const textColor = {
    primary: Colors.background,
    secondary: Colors.text,
    outline: Colors.text,
    ghost: Colors.textSecondary,
    danger: Colors.text,
  }[variant];

  const content = loading ? (
    <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? Colors.background : Colors.text} />
  ) : (
    <Text style={[{ color: textColor, fontSize: FontSize.base, fontWeight: '600' }, titleStyle]}>{title}</Text>
  );

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyle,
        { opacity: disabled ? 0.5 : 1 },
        fullWidth && { alignSelf: 'stretch' },
        icon && { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {icon}
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
});

export default Button;
