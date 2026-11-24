// src/camera/RoadCameraScreen.tsx
// "Road only" mode: rear camera -> YOLOv8 -> tracking, speeds, path prediction -> alert,
// plus an incident photo (with date/time burned in) saved to Firebase for signed-in users.
// The controls are in RoadHud; the boxes and lane lines are in RoadOverlay.
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useSettings } from '../hooks/useSettings';
import { useAlarm } from '../hooks/useAlarm';
import { useRoadMonitor } from '../ml/collision/useRoadMonitor';
import { rgbaToJpegBase64 } from '../utils/jpegBase64';
import { formatStamp, stampTimestamp } from '../utils/stampTimestamp';
import { saveRoadIncident } from '../firebase/roadIncidentService';
import { useRoadEvents } from '../hooks/useRoadEvents';
import { useMountCheck } from '../hooks/useMountCheck';
import { recordSpeed } from '../services/tripStore';
import RoadOverlay from './RoadOverlay';
import RoadHud from './RoadHud';
import LoadingSpinner from './LoadingSpinner';

const MIN_INCIDENT_INTERVAL_MS = 15000; // at most one saved photo per 15 s
// Test mode (tap the "Speed" chip): pretend your own speed, for testing with a video on a laptop.
const TEST_SPEEDS: (number | null)[] = [null, 0, 30, 50, 60, 80];

export default function RoadCameraScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const device = useCameraDevice('back');
  const { settings, uid } = useSettings();
  const [view, setView] = useState({ w: 0, h: 0 });
  const [testIdx, setTestIdx] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const testSpeed = TEST_SPEEDS[testIdx];

  // The frame callback is created once, so anything the photo handler reaches must be a ref.
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const getRoadRef = useRef<() => any>(() => null);
  const getFixRef = useRef<() => any>(() => null);
  const ownKmhRef = useRef<number | null>(null);
  const lastSavedAtRef = useRef(0);

  async function handlePhoto(rgba: ArrayBuffer, w: number, h: number) {
    const currentUid = uidRef.current;
    if (!currentUid || !settingsRef.current.saveDrowsyImages) return; // guests can't save to Firebase
    try {
      const now = new Date();
      const pixels = new Uint8Array(rgba);
      stampTimestamp(pixels, w, h, formatStamp(now));
      const imageBase64 = rgbaToJpegBase64(pixels, w, h, 70);
      const snap = getRoadRef.current();
      const fix = getFixRef.current();
      const reason = snap?.reason && snap.reason !== 'NONE' ? snap.reason : 'APPROACHING';
      await saveRoadIncident(currentUid, {
        type: reason,
        occurredAtIso: now.toISOString(),
        occurredAtLocal: formatStamp(now),
        imageBase64,
        imageWidth: w,
        imageHeight: h,
        ttcSeconds: snap?.ttcSeconds ?? null,
        distanceMeters: snap?.distanceMeters ?? null,
        leadSpeedKmh: snap?.leadSpeedKmh ?? null,
        ownSpeedKmh: ownKmhRef.current,
        latitude: fix?.lat ?? null,
        longitude: fix?.lng ?? null,
      });
      console.log('[incident] photo saved to Firebase');
    } catch (error) {
      console.warn('[incident] failed to save:', error);
    }
  }

  const { roadOutput, road, dets, lane, laneInfo, departure, visibility, perf, debug, modelState, modelError, ready, requestPhoto, getRoad, getFix, gps } =
    useRoadMonitor(settings.collisionTtcSeconds, handlePhoto, {
      overrideSpeedKmh: testSpeed,
      distanceScale: settings.distanceScale,
      followingWarning: settings.followingWarning,
      followingGapSeconds: settings.followingGapSeconds,
      laneDepartureWarning: settings.laneDepartureWarning,
      nightMode: settings.nightMode,
    });
  getRoadRef.current = getRoad;
  getFixRef.current = getFix;

  const ownKmh = testSpeed !== null ? testSpeed : gps.speedKmh;
  ownKmhRef.current = ownKmh;

  const drifting = departure === 'DRIFT_LEFT' || departure === 'DRIFT_RIGHT';
  useAlarm(road.level === 'COLLISION' || drifting, settings);
  useRoadEvents(road, uid, getFix, ownKmh); // trip log + fleet dashboard
  const mountMessage = useMountCheck(laneInfo, ready && testSpeed === null); // not in test mode

  // trip distance / max speed
  useEffect(() => {
    const id = setInterval(() => recordSpeed(testSpeed !== null ? null : gps.speedKmh), 1000);
    return () => clearInterval(id);
  }, [gps.speedKmh, testSpeed]);

  // "Save Incident Photos": when a warning starts, ask the worklet for a picture of that moment.
  const isCollision = road.level === 'COLLISION';
  useEffect(() => {
    if (!isCollision || !settings.saveDrowsyImages || !uid) return;
    const now = Date.now();
    if (now - lastSavedAtRef.current < MIN_INCIDENT_INTERVAL_MS) return;
    lastSavedAtRef.current = now;
    requestPhoto();
  }, [isCollision, settings.saveDrowsyImages, uid, requestPhoto]);

  const onLayout = (e: LayoutChangeEvent) =>
    setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.centerText}>No rear camera found</Text>
      </View>
    );
  }

  const speedSource =
    testSpeed !== null ? `TEST ${testSpeed} km/h`
    : gps.status === 'no-package' ? 'GPS not installed'
    : gps.status === 'no-permission' ? 'GPS no permission'
    : gps.speedKmh !== null ? 'GPS'
    : 'GPS waiting';

  const details = `${debug.fps} fps · boxes ${debug.count} · model ${modelState} · score ${debug.bestScore.toFixed(2)} · ${debug.inSize}px · scale ${settings.distanceScale.toFixed(2)}`;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        outputs={[roadOutput]}
        onError={(e) => console.error('Camera onError:', e.message, e)}
      />

      {ready && <RoadOverlay dets={dets} road={road} view={view} lane={lane} showHud={false} />}

      <RoadHud
        top={insets.top}
        bottom={insets.bottom}
        road={road}
        ready={ready}
        ownKmh={ownKmh}
        speedSource={speedSource}
        laneFound={lane !== null}
        mountMessage={mountMessage}
        departure={departure}
        visibility={visibility}
        eco={perf.eco}
        gapLimitSeconds={settings.followingGapSeconds}
        showDetails={showDetails}
        details={details}
        onClose={() => navigation.goBack()}
        onCycleSpeed={() => setTestIdx((i) => (i + 1) % TEST_SPEEDS.length)}
        onToggleDetails={() => setShowDetails((v) => !v)}
      />

      {!ready && (
        <View style={styles.loading} pointerEvents="none">
          {modelState === 'error' ? (
            <View style={styles.errBox}>
              <Text style={styles.errTitle}>Road model could not load</Text>
              <Text style={styles.errText}>{modelError}</Text>
              <Text style={styles.errText}>Check src/assets/models/yolov8n.tflite exists, then rebuild the app.</Text>
            </View>
          ) : (
            <LoadingSpinner />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centerText: { color: 'white', alignSelf: 'center', marginTop: 50 },
  loading: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center',
  },
  errBox: { marginHorizontal: 30, padding: 18, borderRadius: 16, backgroundColor: 'rgba(127,29,29,0.92)' },
  errTitle: { color: 'white', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  errText: { color: '#fecaca', fontSize: 13, marginTop: 4 },
});