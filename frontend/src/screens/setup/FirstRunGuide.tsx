// src/screens/setup/FirstRunGuide.tsx
// Four-page setup guide in a Modal: Welcome, Permissions, Phone mounting, Privacy.
import React, { useEffect, useState } from 'react';
import { Modal, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { closeSetupGuide, markGuideSeen, showGuideIfFirstRun, useSetupGuideOpen } from './firstRunStore';

const PAGES = ['Welcome', 'Permissions', 'Mount your phone', 'Privacy'];

function MountDiagram({ colors }: { colors: any }) {
  return (
    <View style={[styles.diagram, { borderColor: colors.border }]}>
      <View style={[styles.horizon, { top: '40%', backgroundColor: colors.primary }]} />
      <Text style={[styles.diagramTag, { top: '40%', color: colors.primary }]}>horizon ~ 40% from the top</Text>
      <View style={[styles.road, { borderBottomColor: colors.muted }]} />
      <View style={[styles.centerLine, { backgroundColor: colors.muted }]} />
    </View>
  );
}

export default function FirstRunGuide() {
  const { colors } = useTheme();
  const open = useSetupGuideOpen();
  const [page, setPage] = useState(0);
  const [cam, setCam] = useState<string | null>(null);
  const [loc, setLoc] = useState<string | null>(null);

  useEffect(() => { showGuideIfFirstRun(); }, []);
  useEffect(() => { if (open) setPage(0); }, [open]);

  async function ask(perm: any, set: (s: string) => void) {
    if (Platform.OS !== 'android') return;
    try { set(await PermissionsAndroid.request(perm)); } catch { set('denied'); }
  }
  const state = (s: string | null) => (s === 'granted' ? '✓ Allowed' : s ? 'Not allowed' : 'Allow');
  const finish = () => { markGuideSeen(); closeSetupGuide(); };
  const last = page === PAGES.length - 1;

  return (
    <Modal visible={open} animationType="slide" onRequestClose={finish}>
      <View style={[styles.wrap, { backgroundColor: colors.background }]}>
        <Text style={[styles.step, { color: colors.muted }]}>Step {page + 1} of {PAGES.length}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{PAGES[page]}</Text>

        {page === 0 && (
          <Text style={[styles.body, { color: colors.text }]}>
            ActiveWatch watches for two things while you drive: your own drowsiness (front camera) and the road ahead (rear camera: vehicles, following distance, lane drifting).{'\n\n'}This short guide sets up permissions and shows how to place your phone.
          </Text>
        )}

        {page === 1 && (
          <View>
            <Text style={[styles.body, { color: colors.text }]}>The app needs the camera to see, and location to read your driving speed. Speed is used for time-to-collision and following distance.</Text>
            <Pressable style={[styles.permBtn, { backgroundColor: colors.card }]} onPress={() => ask(PermissionsAndroid.PERMISSIONS.CAMERA, setCam)}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Camera</Text><Text style={{ color: colors.primary }}>{state(cam)}</Text>
            </Pressable>
            <Pressable style={[styles.permBtn, { backgroundColor: colors.card }]} onPress={() => ask(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, setLoc)}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Location (speed)</Text><Text style={{ color: colors.primary }}>{state(loc)}</Text>
            </Pressable>
          </View>
        )}

        {page === 2 && (
          <View>
            <MountDiagram colors={colors} />
            <Text style={[styles.body, { color: colors.text }]}>
              • Hold the phone in a dashboard or windscreen mount, portrait or landscape.{'\n'}
              • Keep it level, not tilted left or right.{'\n'}
              • The rear camera should see the road, with the horizon about 40% from the top.{'\n'}
              • Centre it on the car, pointing straight ahead.{'\n'}
              • Keep the lens clean and the mount firm.
            </Text>
          </View>
        )}

        {page === 3 && (
          <Text style={[styles.body, { color: colors.text }]}>
            Your face is processed on the phone. Video is never uploaded.{'\n\n'}
            Photos of drowsiness or collision warnings are saved only if you turn on "Save Incident Photos" in Settings, and only when you are signed in.{'\n\n'}
            Trips and event records go to your account only when signed in. You can delete any of them in History.
          </Text>
        )}

        <View style={styles.nav}>
          <Pressable onPress={finish}><Text style={{ color: colors.muted, padding: 12 }}>Skip</Text></Pressable>
          <View style={{ flexDirection: 'row' }}>
            {page > 0 && (
              <Pressable onPress={() => setPage(page - 1)} style={[styles.btn, { backgroundColor: colors.card }]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Back</Text>
              </Pressable>
            )}
            <Pressable onPress={() => (last ? finish() : setPage(page + 1))} style={[styles.btn, { backgroundColor: colors.primary, marginLeft: 10 }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{last ? 'Done' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 28, paddingTop: 70 },
  step: { fontSize: 13 },
  title: { fontSize: 30, fontWeight: '700', marginTop: 6, marginBottom: 20 },
  body: { fontSize: 16, lineHeight: 24 },
  permBtn: { flexDirection: 'row', justifyContent: 'space-between', padding: 18, borderRadius: 16, marginTop: 14 },
  diagram: { height: 170, borderWidth: 2, borderRadius: 18, marginBottom: 18, overflow: 'hidden' },
  horizon: { position: 'absolute', left: 0, right: 0, height: 2 },
  diagramTag: { position: 'absolute', left: 10, fontSize: 11, marginTop: -16 },
  road: { position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 0, borderBottomWidth: 90, borderLeftWidth: 40, borderRightWidth: 40, borderLeftColor: 'transparent', borderRightColor: 'transparent', opacity: 0.25 },
  centerLine: { position: 'absolute', bottom: 0, left: '50%', width: 3, height: '38%' },
  nav: { position: 'absolute', left: 28, right: 28, bottom: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 16 },
});