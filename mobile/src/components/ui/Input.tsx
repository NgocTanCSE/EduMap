import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, FontSize } from '../../theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  secureTextEntry?: boolean;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, containerStyle, leftIcon, secureTextEntry, ...rest }) => {
  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.input,
          { flexDirection: 'row', alignItems: 'center', gap: leftIcon ? Spacing.sm : 0 },
          error && { borderColor: Colors.danger },
        ]}
      >
        {leftIcon}
        <TextInput
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={secureTextEntry}
          style={[styles.text, { flex: 1 }]}
          {...rest}
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.sm },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.xs },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
  },
  text: {
    color: Colors.text,
    fontSize: FontSize.base,
    paddingVertical: 0,
  } as TextStyle,
  error: { color: Colors.danger, fontSize: FontSize.xs, marginTop: 2 },
});

export default Input;
