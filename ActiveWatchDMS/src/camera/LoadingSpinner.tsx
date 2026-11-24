// src/camera/LoadingSpinner.tsx
// Rotating ring + pulsing dots shown while the road model loads (no text needed).
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export default function LoadingSpinner({ size = 64, color = '#38bdf8' }: { size?: number; color?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
  }, [spin, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const r = size * 0.34;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute', width: size, height: size, borderRadius: size / 2,
          borderWidth: size * 0.08, borderColor: color + '33', borderTopColor: color,
          transform: [{ rotate }],
        }}
      />
      <Animated.View style={{ width: r, height: r, borderRadius: r / 2, backgroundColor: color, opacity: pulse, transform: [{ scale }] }} />
    </View>
  );
}