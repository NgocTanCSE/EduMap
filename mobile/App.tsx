import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MapPin, MessageSquare, Briefcase, GraduationCap } from 'lucide-react-native';

// Screens
import MapScreen from './src/screens/MapScreen';
import ChatScreen from './src/screens/ChatScreen';
import InternshipScreen from './src/screens/InternshipScreen';
import ScholarshipScreen from './src/screens/ScholarshipScreen';

const Tab = createBottomTabNavigator();

const EduMapDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#09090b',
    card: '#18181b',
    border: '#27272a',
    text: '#ffffff',
    primary: '#eab308', // Yellow
  },
};

export default function App() {
  return (
    <NavigationContainer theme={EduMapDarkTheme}>
      <Tab.Navigator
        id="edumap-main-tabs"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#18181b',
            borderBottomWidth: 1,
            borderBottomColor: '#27272a',
            elevation: 0, // Android shadow
            shadowOpacity: 0, // iOS shadow
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '900',
            fontSize: 20,
          },
          tabBarStyle: {
            backgroundColor: '#18181b',
            borderTopWidth: 1,
            borderTopColor: '#27272a',
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
          tabBarActiveTintColor: '#eab308',
          tabBarInactiveTintColor: '#666',
        }}
      >
        <Tab.Screen 
          name="Map" 
          component={MapScreen} 
          options={{
            title: 'EduMap',
            tabBarLabel: 'Bản đồ',
            tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
          }}
        />
        <Tab.Screen 
          name="Chat" 
          component={ChatScreen} 
          options={{
            title: 'Trợ lý AI',
            tabBarLabel: 'AI Chat',
            tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
          }}
        />
        <Tab.Screen 
          name="Internships" 
          component={InternshipScreen} 
          options={{
            title: 'Thực tập',
            tabBarLabel: 'Thực tập',
            tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
          }}
        />
        <Tab.Screen 
          name="Scholarships" 
          component={ScholarshipScreen} 
          options={{
            title: 'Học bổng',
            tabBarLabel: 'Học bổng',
            tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} />,
          }}
        />
      </Tab.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
