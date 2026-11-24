// navigation/RootNavigator.tsx
import React, { useContext } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainNavigator from "./MainNavigator";
import AuthNavigator from "./AuthNavigator";
import SplashScreen from "../screens/SplashScreen"; // adjust path if it actually lives elsewhere
import { AuthContext } from "../context/AuthContext";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, guest, loading } = useContext(AuthContext);

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user || guest ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}