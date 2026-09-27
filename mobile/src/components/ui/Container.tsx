import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme';

export interface ContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  scrollable?: boolean;
}

/** Full-bleed safe-area container with the app dark background. */
export const Container: React.FC<ContainerProps> = ({ children, style, scrollable }) => {
  const Wrapper = scrollable ? require('react-native').ScrollView : View;
  return (
    <SafeAreaView style={[styles.safe, style]}>
      <Wrapper
        style={[styles.inner]}
        contentContainerStyle={scrollable ? { paddingBottom: 40 } : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Wrapper>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, padding: 16 },
});
