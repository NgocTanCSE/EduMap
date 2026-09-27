import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '../../theme';

export interface AvatarProps {
  uri?: string;
  size?: number;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({ uri, size = 40, style }) => {
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} borderRadius={size / 2} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default Avatar;
