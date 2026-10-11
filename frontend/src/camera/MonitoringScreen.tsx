// src/camera/MonitoringScreen.tsx
// Picks the monitoring screen from Settings -> Monitoring:
//   driver (default) -> DriverMonitorScreen   front camera, drowsiness
//   road             -> RoadCameraScreen      rear camera, collision warning
//   both             -> DualMonitorScreen     both cameras together, ONLY if the phone supports it
// If "both" is saved (for example from another phone) but this phone cannot do it, it
// falls back to driver monitoring. Only the chosen screen is mounted, so the other
// models are not loaded and the other camera is not opened.
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useSettings } from '../hooks/useSettings';
import { useMultiCamSupport } from '../hooks/useMultiCamSupport';
import DriverMonitorScreen from './DriverMonitorScreen';
import RoadCameraScreen from './RoadCameraScreen';
import DualMonitorScreen from './DualMonitorScreen';
import { describeTrip, endTrip, startTrip } from '../services/tripStore';
import { saveTrip } from '../firebase/tripService';

// Wraps whichever screen is chosen: starts a trip when monitoring opens, and when it
// closes shows a short trip summary (and saves it to the account when signed in).
export default function MonitoringScreen() {
  const { uid } = useSettings();
  const uidRef = useRef(uid);
  uidRef.current = uid;

  useEffect(() => {
    startTrip();
    return () => {
      const trip = endTrip();
      if (!trip || trip.durationSec < 20) return; // ignore accidental opens
      if (uidRef.current) saveTrip(uidRef.current, trip).catch((e) => console.warn('[trip] not saved:', e));
      Alert.alert('Trip summary', describeTrip(trip));
    };
  }, []);

  return <MonitoringBody />;
}

function MonitoringBody() {
  const { settings } = useSettings();
  const { checked, supported } = useMultiCamSupport();
  const mode = settings.monitoringMode;

  useEffect(() => {
    console.log('[monitoring] mode =', mode, '| both supported =', checked ? supported : 'checking');
  }, [mode, checked, supported]);

  if (mode === 'road') return <RoadCameraScreen />;

  if (mode === 'both') {
    if (!checked) {
      return (
        <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center' }}>
          <ActivityIndicator color="white" />
        </View>
      );
    }
    if (supported) return <DualMonitorScreen />;
  }

  return <DriverMonitorScreen />;
}