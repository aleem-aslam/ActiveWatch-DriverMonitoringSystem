// src/camera/DualMonitorScreen.tsx
// "Both" mode: front (driver) and rear (road) cameras at the same time, in one multi-cam
// session. ONLY mounted on phones where useMultiCamSupport() says it is supported.
//
// Rear camera = full-screen preview with collision boxes. Front camera = small preview
// in the corner. Either problem (drowsy / collision) raises the same alarm.
//
// NOTE: not yet tested on a real multi-cam phone (the development phone does not support
// it). It uses VisionCamera's low-level session because <Camera> has multi-cam disabled.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import * as VC from 'react-native-vision-camera';
import { useSettings } from '../hooks/useSettings';
import { useAlarm } from '../hooks/useAlarm';
import { useRoadMonitor } from '../ml/collision/useRoadMonitor';
import { useDriverMonitor } from '../ml/useDriverMonitor';
import LoadingSpinner from './LoadingSpinner';
import RoadOverlay from './RoadOverlay';
import { useRoadEvents } from '../hooks/useRoadEvents';
import { recordEvent } from '../services/tripStore';

const VisionCamera: any = (VC as any).VisionCamera;
// The native preview component's exported name differs between releases.
const PreviewComponent: any = (VC as any).PreviewView ?? (VC as any).NativePreviewView;

export default function DualMonitorScreen() {
  const { settings, uid } = useSettings();
  const { roadOutput, road, dets, lane, getFix, gps, ready: roadReady } = useRoadMonitor(settings.collisionTtcSeconds);
  const { faceOutput, drowsy, ready: faceReady } = useDriverMonitor(settings);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);

  const previewBack = useMemo(() => VisionCamera?.createPreviewOutput?.(), []);
  const previewFront = useMemo(() => VisionCamera?.createPreviewOutput?.(), []);

  useAlarm(drowsy || road.level === 'COLLISION', settings);
  useRoadEvents(road, uid, getFix, gps.speedKmh);
  const wasDrowsy = useRef(false);
  useEffect(() => {
    if (drowsy && !wasDrowsy.current) recordEvent('drowsy');
    wasDrowsy.current = drowsy;
  }, [drowsy]);

  useEffect(() => {
    let session: any = null;
    let cancelled = false;
    (async () => {
      try {
        const factory = await VisionCamera.createDeviceFactory();
        const combos: any[][] = factory.supportedMultiCamDeviceCombinations ?? [];
        const combo = combos.find(
          (c) => c.some((d: any) => d.position === 'front') && c.some((d: any) => d.position === 'back')
        );
        if (!combo) throw new Error('No front + rear combination on this phone');
        const front = combo.find((d: any) => d.position === 'front');
        const back = combo.find((d: any) => d.position === 'back');
        session = await VisionCamera.createCameraSession(true);
        await session.configure([
          { input: back, outputs: [{ output: previewBack, mirrorMode: 'off' }, { output: roadOutput, mirrorMode: 'off' }], constraints: [] },
          { input: front, outputs: [{ output: previewFront, mirrorMode: 'on' }, { output: faceOutput, mirrorMode: 'off' }], constraints: [] },
        ]);
        if (cancelled) return;
        await session.start();
      } catch (e: any) {
        console.error('[both]', e);
        setError(e?.message ?? String(e));
      }
    })();
    return () => {
      cancelled = true;
      try {
        session?.stop?.();
      } catch {}
    };
  }, [roadOutput, faceOutput, previewBack, previewFront]);

  const onLayout = (e: LayoutChangeEvent) =>
    setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View style={styles.container} onLayout={onLayout}>
      {PreviewComponent ? (
        <>
          <PreviewComponent style={StyleSheet.absoluteFill} previewOutput={previewBack} resizeMode="cover" />
          <PreviewComponent
            style={[styles.pip, { borderColor: drowsy ? '#ef4444' : '#22c55e' }]}
            previewOutput={previewFront}
            resizeMode="cover"
          />
        </>
      ) : (
        <Text style={styles.centerText}>Camera preview is unavailable in this VisionCamera version.</Text>
      )}

      {roadReady && faceReady && <RoadOverlay dets={dets} road={road} view={view} lane={lane} />}

      {drowsy && (
        <View pointerEvents="none" style={styles.drowsyBanner}>
          <Text style={styles.bannerIcon}>⚠</Text>
          <Text style={styles.bannerText}>DROWSINESS DETECTED</Text>
        </View>
      )}

      {(!roadReady || !faceReady) && (
        <View style={styles.loading}>
          <LoadingSpinner />
        </View>
      )}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.text}>Both cameras could not start: {error}</Text>
          <Text style={styles.text}>Choose Driver or Road in Settings.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centerText: { color: 'white', alignSelf: 'center', marginTop: 60 },
  pip: { position: 'absolute', bottom: 40, right: 14, width: 110, height: 150, borderRadius: 14, overflow: 'hidden', borderWidth: 3 },
  drowsyBanner: {
    position: 'absolute', top: 180, left: 20, right: 20, backgroundColor: 'rgba(239,68,68,0.92)', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  bannerIcon: { color: 'white', fontSize: 28, marginRight: 10 },
  bannerText: { color: 'white', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 },
  loading: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center',
  },
  errorBox: { position: 'absolute', bottom: 40, left: 20, right: 150, backgroundColor: 'rgba(0,0,0,0.75)', padding: 12, borderRadius: 12 },
  text: { color: 'white', fontSize: 14 },
});