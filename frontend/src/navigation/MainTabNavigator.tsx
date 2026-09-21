
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/home/HomeScreen';
// import HistoryScreen from '../screens/history/HistoryScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
  Profile: undefined;
};


const Tab = createBottomTabNavigator<MainTabParamList>();


export default function MainTabNavigator(){

return (

<Tab.Navigator>

<Tab.Screen
name="Home"
component={HomeScreen}
/>


<Tab.Screen
name="History"
component={HistoryScreen}
/>


<Tab.Screen
name="Settings"
component={SettingsScreen}
/>


<Tab.Screen
name="Profile"
component={ProfileScreen}
/>


</Tab.Navigator>

);

}