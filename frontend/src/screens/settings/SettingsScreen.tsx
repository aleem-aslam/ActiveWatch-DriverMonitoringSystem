import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { useTheme } from '../../theme/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { useSettings, type MonitoringMode } from '../../hooks/useSettings';
import { useMultiCamSupport } from '../../hooks/useMultiCamSupport';
import { openSetupGuide } from '../setup/firstRunStore';

const MODES: { key: MonitoringMode; title: string; sub: string }[] = [
  { key: 'driver', title: 'Driver monitoring', sub: 'Front camera. Detects drowsiness.' },
  { key: 'road', title: 'Road monitoring', sub: 'Rear camera. Detects vehicles ahead and warns of a collision.' },
  { key: 'both', title: 'Both together', sub: 'Front and rear cameras at the same time.' },
];

export default function SettingsScreen({ navigation }: any) {
  const { colors, mode, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const { loading, guest } = useContext(AuthContext) as any;
  // settings: shared with the camera, so every change applies immediately.
  // update(): apply now + save to Firebase when signed in. preview(): apply now, no save (slider drag).
  const { settings, update, preview, reset, saving, loggedIn } = useSettings();

  const { checked: multiChecked, supported: multiSupported } = useMultiCamSupport();
  // A saved "both" from another phone shows as "driver" here, matching what the camera will run.
  const activeMode: MonitoringMode =
    settings.monitoringMode === 'both' && multiChecked && !multiSupported ? 'driver' : settings.monitoringMode;

  const handleStart = () => navigation.navigate('Camera');

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const track = { false: colors.border, true: colors.primary };

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
              ? 'Guest mode: changes apply right away but are only kept for this session. Sign in to save them to your account.'
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
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Monitoring</Text>
        <Text style={[styles.helper, { color: colors.muted }]}>What the camera screen runs when you press Start.</Text>

        {MODES.map((m) => {
          const disabled = m.key === 'both' && (!multiChecked || !multiSupported);
          const selected = activeMode === m.key;
          return (
            <Pressable
              key={m.key}
              disabled={disabled}
              onPress={() => update({ monitoringMode: m.key })}
              style={[
                styles.modeRow,
                { borderColor: selected ? colors.primary : colors.border, opacity: disabled ? 0.45 : 1 },
              ]}
            >
              <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
                {selected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.text, fontWeight: '600' }]}>{m.title}</Text>
                <Text style={[styles.helper, { color: colors.muted }]}>
                  {disabled
                    ? multiChecked
                      ? 'Not supported: this phone cannot run both cameras at the same time.'
                      : 'Checking whether this phone supports it...'
                    : m.sub}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {activeMode !== 'driver' && (
          <View style={styles.sliderBlock}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              Collision warning at: {settings.collisionTtcSeconds.toFixed(1)} seconds
            </Text>
            <Text style={[styles.helper, { color: colors.muted }]}>
              Warn when the time to hit the vehicle ahead drops below this. Higher warns earlier.
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={5}
              step={0.1}
              value={settings.collisionTtcSeconds}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
              onValueChange={(v) => preview({ collisionTtcSeconds: v })}
              onSlidingComplete={(v) => update({ collisionTtcSeconds: v })}
            />
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Detection</Text>

        <View style={styles.sliderBlock}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            Drowsiness Time: {settings.drowsinessTimeSeconds.toFixed(1)} seconds
          </Text>
          <Text style={[styles.helper, { color: colors.muted }]}>
            How long your eyes must stay closed before the drowsiness alert starts.
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.5}
            maximumValue={3}
            step={0.1}
            value={settings.drowsinessTimeSeconds}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
            onValueChange={(v) => preview({ drowsinessTimeSeconds: v })}
            onSlidingComplete={(v) => update({ drowsinessTimeSeconds: v })}
          />
        </View>

        <View style={styles.sliderBlock}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            Sensitivity: {Math.round(settings.drowsinessSensitivity)}%
          </Text>
          <Text style={[styles.helper, { color: colors.muted }]}>
            Higher flags drowsiness more easily (partly closed eyes count). Lower needs eyes more fully closed.
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={settings.drowsinessSensitivity}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
            onValueChange={(v) => preview({ drowsinessSensitivity: v })}
            onSlidingComplete={(v) => update({ drowsinessSensitivity: v })}
          />
        </View>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>No Face Detected Alert</Text>
          <Switch value={settings.noFaceAlert} onValueChange={(v) => update({ noFaceAlert: v })} trackColor={track} />
        </View>
        <Text style={[styles.helper, { color: colors.muted }]}>
          Sound and vibrate if no face is seen for 3 seconds.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Alerts</Text>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Alert Sound</Text>
          <Switch value={settings.alertSound} onValueChange={(v) => update({ alertSound: v })} trackColor={track} />
        </View>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Vibration</Text>
          <Switch value={settings.vibration} onValueChange={(v) => update({ vibration: v })} trackColor={track} />
        </View>

        <View style={styles.sliderBlock}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            Alert Duration: {settings.alertDurationSeconds.toFixed(1)} seconds
          </Text>
          <Text style={[styles.helper, { color: colors.muted }]}>
            How long each beep and vibration lasts. It repeats until you are alert again.
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.2}
            maximumValue={2}
            step={0.1}
            value={settings.alertDurationSeconds}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
            onValueChange={(v) => preview({ alertDurationSeconds: v })}
            onSlidingComplete={(v) => update({ alertDurationSeconds: v })}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Road warnings</Text>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Following-distance warning</Text>
          <Switch value={settings.followingWarning} onValueChange={(v) => update({ followingWarning: v })} trackColor={track} />
        </View>
        {settings.followingWarning && (
          <View style={styles.sliderBlock}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Minimum gap: {settings.followingGapSeconds.toFixed(1)} seconds</Text>
            <Text style={[styles.helper, { color: colors.muted }]}>Warns when the time gap to the car ahead is shorter than this (above about 18 km/h).</Text>
            <Slider
              style={styles.slider} minimumValue={0.8} maximumValue={3} step={0.1}
              value={settings.followingGapSeconds}
              minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary}
              onValueChange={(v) => preview({ followingGapSeconds: v })}
              onSlidingComplete={(v) => update({ followingGapSeconds: v })}
            />
          </View>
        )}

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Lane-departure warning</Text>
          <Switch value={settings.laneDepartureWarning} onValueChange={(v) => update({ laneDepartureWarning: v })} trackColor={track} />
        </View>
        <Text style={[styles.helper, { color: colors.muted }]}>Needs visible lane markings; works above 35 km/h.</Text>

        <Text style={[styles.rowLabel, { color: colors.text, marginTop: 18 }]}>Night / low visibility</Text>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {(['auto', 'on', 'off'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => update({ nightMode: m })}
              style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 14, marginRight: 8, backgroundColor: settings.nightMode === m ? colors.primary : colors.border }}
            >
              <Text style={{ color: settings.nightMode === m ? '#fff' : colors.text, fontWeight: '600' }}>{m === 'auto' ? 'Auto' : m === 'on' ? 'Always on' : 'Off'}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.helper, { color: colors.muted }]}>Brightens the picture and lowers the detection threshold in the dark or in rain.</Text>

        <TouchableOpacity style={[styles.outlineButton, { borderColor: colors.primary, marginTop: 18 }]} onPress={() => navigation.navigate('Calibration')}>
          <Text style={{ color: colors.primary }}>Calibrate distance (current ×{settings.distanceScale.toFixed(2)})</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Safety & Records</Text>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>Save Incident Photos</Text>
          <Switch
            value={loggedIn && settings.saveDrowsyImages}
            disabled={!loggedIn}
            onValueChange={(v) => update({ saveDrowsyImages: v })}
            trackColor={track}
          />
        </View>
        <Text style={[styles.helper, { color: colors.muted }]}>
          {loggedIn
            ? 'Saves a time-stamped photo to your account when drowsiness or a collision warning is detected.'
            : 'Sign in to save snapshots to your account.'}
        </Text>

      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Privacy</Text>
        <Text style={[styles.helper, { color: colors.muted }]}>
          Your face is processed on the phone and video is never uploaded. Photos are saved only if you turn on "Save Incident Photos" and are signed in. Trips and events go to your account only when you are signed in, and you can delete them in History.
        </Text>
        <TouchableOpacity style={[styles.outlineButton, { borderColor: colors.primary, marginTop: 14 }]} onPress={openSetupGuide}>
          <Text style={{ color: colors.primary }}>Show setup guide</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.outlineButton, styles.fullWidthButton, { borderColor: colors.danger }]} onPress={reset}>
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
  helper: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  rowLabel: { fontSize: 15, flexShrink: 1, paddingRight: 12 },
  sliderBlock: { marginTop: 18 },
  modeRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, padding: 14, marginTop: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  slider: { width: '100%', height: 40, marginTop: 6 },
  outlineButton: { height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  fullWidthButton: { marginTop: 25 },
  primaryButton: { height: 55, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});