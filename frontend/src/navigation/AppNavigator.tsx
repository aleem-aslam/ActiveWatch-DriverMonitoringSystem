import React from 'react';
import { NavigationContainer } from '@react-navigation/native';

import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';


export default function AppNavigator() {

  // temporary until Firebase Auth Context is created

  const isAuthenticated = false;


  return (
    <NavigationContainer>

      {
        isAuthenticated 
        ?
        <MainTabNavigator />
        :
        <AuthNavigator />
      }

    </NavigationContainer>
  );
}