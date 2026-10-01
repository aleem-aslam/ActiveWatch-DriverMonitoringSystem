// navigation/MainNavigator.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@react-native-vector-icons/ionicons';

import HomeScreen from '../screens/home/HomeScreen';
import HistoryScreen from '../screens/history/HistoryScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import CameraScreen from '../camera/CameraScreen';
import { useTheme } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ICONS: Record<string, { outline: string; filled: string }> = {
  Home: { outline: 'home-outline', filled: 'home' },
  History: { outline: 'time-outline', filled: 'time' },
  Profile: { outline: 'person-outline', filled: 'person' },
  Settings: { outline: 'settings-outline', filled: 'settings' },
};

function AnimatedTabIcon({ routeName, focused, color, size }: { routeName: string; focused: boolean; color: string; size: number }) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  const iconSet = ICONS[routeName] ?? ICONS.Home;
  const name = focused ? iconSet.filled : iconSet.outline;

  const pillScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const iconScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const iconLift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });

  return (
    <View style={styles.iconWrap}>
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: color + '24',
            borderColor: color + '3D',
            opacity: progress,
            transform: [{ scale: pillScale }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: iconScale }, { translateY: iconLift }] }}>
        <Ionicons name={name as any} size={size} color={color} />
      </Animated.View>
    </View>
  );
}

function Tabs() {
  const { colors, mode } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => (
          <AnimatedTabIcon routeName={route.name} focused={focused} color={color} size={size} />
        ),
        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          left: 28,
          right: 28,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          borderWidth: mode === 'dark' ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
          paddingBottom: 10,
          paddingTop: 10,
          elevation: 14,
          shadowColor: '#000',
          shadowOpacity: mode === 'dark' ? 0.35 : 0.14,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 18,
        },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Camera" component={CameraScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 52, height: 38, alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    width: 52,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
