import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootParamList } from './types';

type TabName = 'Home' | 'Map' | 'Career' | 'More';

/** Root navigation container ref + helpers. */
export const navigationRef = createNavigationContainerRef<RootParamList>();

export function navigate(name: keyof RootParamList, params?: object) {
  if (navigationRef.isReady()) {
    // Cast navigate to a simple signature: TypeScript's overload resolution
    // rejects union-typed route names, but the runtime ref handles any valid
    // RootParamList key. This preserves the name/params type without `as any`.
    const navigateRef = navigationRef.navigate as (
      name: keyof RootParamList,
      params?: object,
    ) => void;
    navigateRef(name, params);
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
export function switchTab(tab: TabName) {
  if (navigationRef.isReady()) {
    // Tab names ('Map', 'Career', 'More') are defined on TabParamList, not
    // RootParamList. React Navigation's navigate() searches the entire tree at
    // runtime, so `as never` safely bridges the type gap without @ts-ignore.
    navigationRef.navigate(tab as never);
  }
}

export default navigationRef;
