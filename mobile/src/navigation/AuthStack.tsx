import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../theme';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import TwoFactorScreen from '../screens/auth/TwoFactorScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import type { RootParamList } from './types';

const Stack = createNativeStackNavigator<RootParamList>();

export const AuthStack: React.FC = () => (
  <Stack.Navigator
    id="auth-stack"
    initialRouteName="Login"
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: Colors.background },
      animation: 'slide_from_right',
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
  </Stack.Navigator>
);

export default AuthStack;
