import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootParamList } from './types';

/** Root navigation container ref + helpers. */
export const navigationRef = createNavigationContainerRef<RootParamList>();

export function navigate(name: keyof RootParamList, params?: any) {
  if (navigationRef.isReady()) {
    // @ts-ignore traverse nested stacks
    navigationRef.navigate(name as any, params);
  }
}

export function canGoBack() {
  return navigationRef.isReady() && navigationRef.canGoBack();
}

export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}

/** Switch to a bottom-tab from anywhere (used by Home / More dashboard). */
export function switchTab(tab: 'Home' | 'Map' | 'Career' | 'More') {
  if (navigationRef.isReady()) {
    (navigationRef as any).navigate(tab);
  }
}

export default navigationRef;
