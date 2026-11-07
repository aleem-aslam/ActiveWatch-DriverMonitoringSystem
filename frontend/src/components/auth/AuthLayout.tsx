// src/components/auth/AuthLayout.tsx
// Shared look of the Login / Register / Forgot-password screens:
// a coloured header with the app mark, and a rounded white sheet that holds the form.
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  title: string;
  subtitle: string;
  icon?: string;
  compact?: boolean; // smaller header (Register / Forgot)
  children: React.ReactNode;
};

const HERO = '#1d4ed8';

export default function AuthLayout({ title, subtitle, icon = 'car-sport', compact, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const heroH = (compact ? 190 : 250) + insets.top;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: HERO }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        bounces={false}
      >
        {/* header */}
        <View style={[styles.hero, { height: heroH, paddingTop: insets.top + 12 }]}>
          <View style={[styles.blob, { width: 220, height: 220, right: -70, top: -50, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <View style={[styles.blob, { width: 140, height: 140, left: -50, bottom: 10, backgroundColor: 'rgba(255,255,255,0.07)' }]} />
          <View style={styles.badge}>
            <Ionicons name={icon as any} size={compact ? 30 : 38} color={HERO} />
          </View>
          <Text style={styles.brand}>{title}</Text>
          <Text style={styles.tag}>{subtitle}</Text>
        </View>

        {/* sheet */}
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function FeatureRow({ colors }: { colors: any }) {
  const items = [
    { icon: 'eye-outline', label: 'Drowsiness alerts' },
    { icon: 'car-outline', label: 'Collision warnings' },
    { icon: 'analytics-outline', label: 'Trip history' },
  ];
  return (
    <View style={styles.features}>
      {items.map((i) => (
        <View key={i.label} style={styles.feature}>
          <View style={[styles.featureIcon, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name={i.icon as any} size={18} color={colors.primary} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 6, textAlign: 'center' }}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: HERO, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingBottom: 34 },
  blob: { position: 'absolute', borderRadius: 999 },
  badge: {
    width: 76, height: 76, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  brand: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 14, letterSpacing: 0.3 },
  tag: { color: 'rgba(255,255,255,0.82)', fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 },
  sheet: { flex: 1, marginTop: -28, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 28 },
  features: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 28 },
  feature: { alignItems: 'center', width: 96 },
  featureIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});