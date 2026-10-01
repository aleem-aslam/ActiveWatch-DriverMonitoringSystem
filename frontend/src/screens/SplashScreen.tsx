// screens/splash/SplashScreen.tsx — navigation prop and timer removed
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function SplashScreen() {
  const { colors } = useTheme();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.6, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.timing(ringScale, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
    // No setTimeout, no navigation.replace — RootNavigator switches away from
    // this automatically once AuthContext.loading becomes false.
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.logoWrap}>
        
        <Animated.View style={[styles.ring, { borderColor: colors.primary, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
        <Animated.Text style={[styles.logo, { color: colors.primary, opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          ActiveWatch
        </Animated.Text>
      </View>
      <Animated.Text style={[styles.subtitle, { color: colors.muted, opacity: subtitleOpacity }]}>
        Driver Monitoring System
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoWrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2 },
  logo: { fontSize: 42, fontWeight: '800' },
  subtitle: { marginTop: 12, fontSize: 16 },
});