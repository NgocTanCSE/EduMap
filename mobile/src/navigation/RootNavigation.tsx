import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootParamList } from './types';

type TabName = 'Home' | 'Map' | 'Career' | 'More';


export const navigationRef = createNavigationContainerRef<RootParamList>();

export function navigate(name: keyof RootParamList, params?: object) {
  if (navigationRef.isReady()) {



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


export function switchTab(tab: TabName) {
  if (navigationRef.isReady()) {


    
    navigationRef.navigate(tab as never);
  }
}

export default navigationRef;
