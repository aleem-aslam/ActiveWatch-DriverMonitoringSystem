import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { useTheme } from '../../theme/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { updateUserSettings } from '../../firebase/userService';

const DEFAULT_SETTINGS = {
  alertSound: true,
  vibration: true,
  drowsinessSensitivity: 80,
  alertDurationSeconds: 0.5,
  noFaceAlert: false,
  saveDrowsyImages: false,
  accidentDetection: true,
};

export default function SettingsScreen({ navigation }: any) {
  const { colors, mode, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const { user, profile: userDoc, loading, guest } = useContext(AuthContext);
  const loggedIn = Boolean(user);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userDoc?.settings) {
      setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...prev, ...userDoc.settings }));
    }
  }, [userDoc?.settings]);

  const persist = async (patch: Partial<typeof DEFAULT_SETTINGS>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    if (!user) return; // guest: local-only for this session
    setSaving(true);
    try {
      await updateUserSettings(user.uid, patch);
    } catch (error) {
      console.warn('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => persist(DEFAULT_SETTINGS);
  const handleStart = () => navigation.navigate('Camera');

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 20, paddingBottom: tabBarHeight + 24 }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      {!loggedIn && (
        <View style={[styles.noticeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.muted }}>
            {guest
              ? 'Sign in to save these settings to your account — for now, changes only apply to this session.'
              : 'Sign in to save these settings to your account.'}
          </Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Appearance</Text>
        <Text style={[styles.subtext, { color: colors.muted }]}>Current mode: {mode}</Text>
        <TouchableOpacity onPress={toggleTheme} style={[styles.outlineButton, { borderColor: colors.primary }]}>
          <Text style={{ color: colors.primary }}>Change Theme</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Detection</Text>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Alert Sound</Text>
          <Switch value={settings.alertSound} onValueChange={(v) => persist({ alertSound: v })} trackColor={{ false: colors.border, true: colors.primary }} />
        </View>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Vibration</Text>
          <Switch value={settings.vibration} onValueChange={(v) => persist({ vibration: v })} trackColor={{ false: colors.border, true: colors.primary }} />
        </View>

        <View style={styles.sliderBlock}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Sensitivity: {Math.round(settings.drowsinessSensitivity)}%</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={settings.drowsinessSensitivity}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
            onValueChange={(v) => setSettings((prev) => ({ ...prev, drowsinessSensitivity: v }))}
            onSlidingComplete={(v) => persist({ drowsinessSensitivity: v })}
          />
        </View>

        <View style={styles.sliderBlock}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Alert Duration: {settings.alertDurationSeconds.toFixed(1)} seconds</Text>
          <Slider
            style={styles.slider}
            minimumValue={0.2}
            maximumValue={2}
            step={0.1}
            value={settings.alertDurationSeconds}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
            onValueChange={(v) => setSettings((prev) => ({ ...prev, alertDurationSeconds: v }))}
            onSlidingComplete={(v) => persist({ alertDurationSeconds: v })}
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>No Face Detected Alert</Text>
          <Switch value={settings.noFaceAlert} onValueChange={(v) => persist({ noFaceAlert: v })} trackColor={{ false: colors.border, true: colors.primary }} />
        </View>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Save Drowsy Images</Text>
          <Switch value={settings.saveDrowsyImages} onValueChange={(v) => persist({ saveDrowsyImages: v })} trackColor={{ false: colors.border, true: colors.primary }} />
        </View>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Accident Detection</Text>
          <Switch value={settings.accidentDetection} onValueChange={(v) => persist({ accidentDetection: v })} trackColor={{ false: colors.border, true: colors.primary }} />
        </View>
      </View>

      <TouchableOpacity style={[styles.outlineButton, styles.fullWidthButton, { borderColor: colors.danger }]} onPress={handleReset}>
        <Text style={{ color: colors.danger }}>{saving ? 'Saving…' : 'Reset to Defaults'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleStart}>
        <Text style={styles.buttonText}>Start</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contentContainer: { padding: 25 },
  title: { fontSize: 34, fontWeight: '700' },
  noticeCard: { marginTop: 20, padding: 16, borderRadius: 16, borderWidth: 1 },
  card: { marginTop: 20, padding: 22, borderRadius: 20 },
  sectionHeading: { fontSize: 20, fontWeight: '700' },
  subtext: { marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  rowLabel: { fontSize: 15, flexShrink: 1, paddingRight: 12 },
  sliderBlock: { marginTop: 18 },
  slider: { width: '100%', height: 40, marginTop: 6 },
  outlineButton: { height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  fullWidthButton: { marginTop: 25 },
  primaryButton: { height: 55, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});