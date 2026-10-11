// src/camera/CalibrationScreen.tsx
// Distance calibration: park behind a car, enter the real distance, tap Measure.
// The screen compares it to what the app measures and saves a correction factor.
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useSettings } from '../hooks/useSettings';
import { useRoadMonitor } from '../ml/collision/useRoadMonitor';

const SAMPLE_MS = 3000;
const MIN_SAMPLES = 8;

export default function CalibrationScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const device = useCameraDevice('back');
  const { settings, update } = useSettings();
  const [text, setText] = useState('10');
  const [msg, setMsg] = useState('Park behind a car, stand still, enter the real distance to it, then tap Measure.');
  const [busy, setBusy] = useState(false);

  // measure with NO correction applied, so the result is the raw error
  const { roadOutput, road, ready } = useRoadMonitor(settings.collisionTtcSeconds, undefined, {
    overrideSpeedKmh: 0, distanceScale: 1, followingWarning: false, laneDepartureWarning: false, nightMode: settings.nightMode,
  });
  const roadRef = useRef(road);
  roadRef.current = road;

  function measure() {
    const real = parseFloat(text.replace(',', '.'));
    if (!(real >= 3 && real <= 60)) { setMsg('Enter a distance between 3 and 60 metres.'); return; }
    setBusy(true);
    setMsg('Measuring… keep the phone still.');
    const samples: number[] = [];
    const id = setInterval(() => {
      const d = roadRef.current.distanceMeters;
      if (d !== null && d > 0) samples.push(d);
    }, 200);
    setTimeout(async () => {
      clearInterval(id);
      setBusy(false);
      if (samples.length < MIN_SAMPLES) { setMsg('No car detected steadily. Make sure one car is clearly in view and try again.'); return; }
      samples.sort((a, b) => a - b);
      const med = samples[Math.floor(samples.length / 2)];
      const k = Math.max(0.4, Math.min(2.5, real / med));
      await update({ distanceScale: Number(k.toFixed(3)) } as any);
      setMsg(`App measured ${med.toFixed(1)} m, real ${real.toFixed(1)} m. Correction saved: ×${k.toFixed(2)}.`);
    }, SAMPLE_MS);
  }

  async function reset() {
    await update({ distanceScale: 1 } as any);
    setMsg('Calibration reset to ×1.00.');
  }

  if (!device) return <View style={styles.container}><Text style={styles.white}>No rear camera found</Text></View>;

  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive outputs={[roadOutput]} />
      <Pressable onPress={() => navigation.goBack()} style={[styles.close, { top: insets.top + 8 }]}><Text style={styles.white}>✕</Text></Pressable>
      <View style={[styles.panel, { bottom: insets.bottom + 12 }]}>
        <Text style={styles.head}>Distance calibration</Text>
        <Text style={styles.sub}>Current correction: ×{settings.distanceScale.toFixed(2)}{ready ? '' : '  (loading model…)'}</Text>
        <Text style={styles.sub}>Detected now: {road.distanceMeters !== null ? road.distanceMeters.toFixed(1) + ' m' : '—'}</Text>
        <View style={styles.row}>
          <Text style={styles.white}>Real distance (m)</Text>
          <TextInput value={text} onChangeText={setText} keyboardType="decimal-pad" style={styles.input} />
        </View>
        <Text style={styles.msg}>{msg}</Text>
        <View style={styles.row}>
          <Pressable onPress={reset} style={[styles.btn, { backgroundColor: '#334155' }]}><Text style={styles.white}>Reset</Text></Pressable>
          <Pressable disabled={busy || !ready} onPress={measure} style={[styles.btn, { backgroundColor: busy || !ready ? '#475569' : '#2563eb' }]}>
            <Text style={styles.white}>{busy ? 'Measuring…' : 'Measure'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  white: { color: 'white', fontWeight: '600' },
  close: { position: 'absolute', left: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(15,23,42,0.72)', alignItems: 'center', justifyContent: 'center' },
  panel: { position: 'absolute', left: 12, right: 12, backgroundColor: 'rgba(15,23,42,0.85)', borderRadius: 22, padding: 16 },
  head: { color: 'white', fontSize: 18, fontWeight: '800' },
  sub: { color: '#94a3b8', marginTop: 4 },
  msg: { color: '#e2e8f0', marginTop: 10, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  input: { backgroundColor: '#1e293b', color: 'white', minWidth: 80, textAlign: 'center', borderRadius: 10, paddingVertical: 6 },
  btn: { flex: 1, marginHorizontal: 4, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
});