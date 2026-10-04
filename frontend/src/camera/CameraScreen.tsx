import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, Vibration, View } from 'react-native';
import { Camera, useCameraDevice, useFrameOutput, type Frame } from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';
import { preprocessFrame, floatRgbToRgba, MODEL_INPUT_SIZE } from '../ml/framePreprocessor';

import { runFaceLandmarkModel } from '../ml/drowsinessDetector';
import { isFaceGeometryPlausible } from '../ml/faceValidator';
import { calculateEAR } from '../ml/earCalculator';
import { DrowsinessStateMachine } from '../ml/drowsinessState';
import { configFromSettings } from '../ml/detectionConfig';
import { DrowsinessLevel, type DrowsinessSnapshot } from '../../types';
import { loadAlertSound, playAlertBeep, stopAlertBeep, unloadAlertSound } from '../services/beepAlert';
import { useSettings } from '../hooks/useSettings';
import { rgbaToJpegBase64 } from '../utils/jpegBase64';
import { saveDrowsyEvent } from '../firebase/drowsyEventService';

const MODEL_ASSET = require('../assets/models/face_landmark.tflite');

// Front-camera previews are normally shown mirrored. If the box moves the
// opposite way to your face horizontally, flip this to false.
const MIRROR_BOX = true;

const GREEN = '#22c55e';
const RED = '#ef4444';

const NO_FACE_ALERT_AFTER_MS = 3000; // "No Face Detected Alert": face missing this long -> alert
const MIN_SAVE_INTERVAL_MS = 10000; // at most one saved drowsy snapshot per 10 s
const ALERT_GAP_MS = 800; // pause between repeated alerts

// Face box in normalized (0..1) frame coordinates, plus the frame size it was
// computed from (needed to map onto the screen under resizeMode="cover").
type FaceBox = { x0: number; y0: number; x1: number; y1: number; frameW: number; frameH: number };

function computeFaceBox(landmarks: any[], frameW: number, frameH: number): FaceBox | null {
  if (!landmarks || landmarks.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  // Landmarks are in model-input pixels (0..192); tolerate already-normalized output too.
  const div = Math.max(maxX, maxY) > 2 ? MODEL_INPUT_SIZE : 1;
  const padX = ((maxX - minX) / div) * 0.1;
  const padY = ((maxY - minY) / div) * 0.1;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  // Landmarks are 0..1 within the centered SQUARE crop the preprocessor took
  // (side = min(frameW, frameH)). Convert to 0..1 of the FULL frame.
  const side = Math.min(frameW, frameH);
  const cropX0 = (frameW - side) / 2;
  const cropY0 = (frameH - side) / 2;
  const toFrameX = (nx: number) => clamp((cropX0 + nx * side) / frameW);
  const toFrameY = (ny: number) => clamp((cropY0 + ny * side) / frameH);

  return {
    x0: toFrameX(minX / div - padX),
    y0: toFrameY(minY / div - padY),
    x1: toFrameX(maxX / div + padX),
    y1: toFrameY(maxY / div + padY),
    frameW,
    frameH,
  };
}

export default function CameraScreen() {
  const device = useCameraDevice('front');
  const { settings, uid } = useSettings();

  const modelHook = useTensorflowModel(MODEL_ASSET, []);
  const tfModel = modelHook.model;

  const [snapshot, setSnapshot] = useState<DrowsinessSnapshot>({
    level: DrowsinessLevel.NO_FACE,
    ear: 0,
    eyesClosedForMs: 0,
    faceScore: 0,
    timestamp: Date.now(),
  });
  const [faceBox, setFaceBox] = useState<FaceBox | null>(null);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [noFaceAlertOn, setNoFaceAlertOn] = useState(false);

  const stateMachineRef = useRef(new DrowsinessStateMachine());
  const lastEarLogRef = useRef(0);
  const fpsFramesRef = useRef(0);

  // The frame-output callback below is created once (memoized) and keeps
  // calling the SAME processFaceDataOnJS, so anything that can change over time
  // must be read through refs, never straight from state/props.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const lastSnapshotRef = useRef<DrowsinessSnapshot | null>(null);
  const lastSavedAtRef = useRef(0);

  // JS -> worklet flag: "grab the next frame as a snapshot".
  const captureRequest = useMemo(() => createSynchronizable(false), []);

  useEffect(() => {
    loadAlertSound();
    return () => unloadAlertSound();
  }, []);

  // Settings -> detection: sensitivity and drowsiness time reach the state machine.
  useEffect(() => {
    stateMachineRef.current.setConfig(configFromSettings(settings));
  }, [settings.drowsinessSensitivity, settings.drowsinessTimeSeconds]);

  // Saves the snapshot the worklet captured. Only used via refs (see note above).
  async function handleCapturedImage(rgba: ArrayBuffer) {
    const currentUid = uidRef.current;
    const s = settingsRef.current;
    if (!currentUid || !s.saveDrowsyImages) return; // guests can't save to Firebase
    try {
      const imageBase64 = rgbaToJpegBase64(new Uint8Array(rgba), MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 70);
      const snap = lastSnapshotRef.current;
      await saveDrowsyEvent(currentUid, {
        imageBase64,
        ear: snap?.ear ?? 0,
        eyesClosedForMs: Math.round(snap?.eyesClosedForMs ?? 0),
        drowsyTimeSeconds: s.drowsinessTimeSeconds,
      });
      console.log('[drowsy-image] saved to Firebase');
    } catch (error) {
      console.warn('[drowsy-image] failed to save:', error);
    }
  }

  // Plain JS function on the React/JS thread, invoked from the worklet via scheduleOnRN.
  function processFaceDataOnJS(outputs: ArrayBuffer[], frameW: number, frameH: number, capturedRgba: ArrayBuffer | null) {
    if (capturedRgba) handleCapturedImage(capturedRgba);
    if (!outputs || outputs.length === 0) return;

    const face = runFaceLandmarkModel(outputs);
    const isValid = face ? isFaceGeometryPlausible(face) : false;

    let currentEar = 0;
    if (isValid && face?.landmarks) {
      currentEar = calculateEAR(face.landmarks).average;
    }

    const next = stateMachineRef.current.update(
      currentEar,
      face?.faceScore || 0,
      isValid,
      Date.now()
    );
    lastSnapshotRef.current = next;

    // TEMP diagnostic (about 1x/second): processed FPS + EAR vs. state, to tune thresholds.
    fpsFramesRef.current += 1;
    const nowMs = Date.now();
    if (nowMs - lastEarLogRef.current > 1000) {
      const fps = (fpsFramesRef.current * 1000) / (nowMs - lastEarLogRef.current);
      fpsFramesRef.current = 0;
      lastEarLogRef.current = nowMs;
      console.log(
        `[EAR] fps=${fps.toFixed(1)} ear=${currentEar.toFixed(3)} level=${next.level} closedMs=${Math.round(next.eyesClosedForMs)} valid=${isValid}`
      );
    }

    setSnapshot(next);
    setFaceBox(
      isValid && face?.landmarks && next.level !== DrowsinessLevel.NO_FACE
        ? computeFaceBox(face.landmarks, frameW, frameH)
        : null
    );
  }

  // Memoized so the native frame pipeline isn't rebuilt on every re-render
  // (setSnapshot re-renders this screen every processed frame).
  const frameOutputOptions = useMemo(
    () => ({
      pixelFormat: 'rgb' as const,
      dropFramesWhileBusy: true,
      enablePhysicalBufferRotation: true,
      onFrame(frame: Frame) {
        'worklet';
        if (tfModel == null) {
          frame.dispose();
          return;
        }
        try {
          const input = preprocessFrame(frame);
          const outputs = tfModel.runSync([input.buffer as ArrayBuffer]);

          // If JS asked for a snapshot, send this exact frame's crop along (once).
          let capturedRgba: ArrayBuffer | null = null;
          if (captureRequest.getBlocking()) {
            captureRequest.setBlocking(false);
            capturedRgba = floatRgbToRgba(input).buffer as ArrayBuffer;
          }

          scheduleOnRN(processFaceDataOnJS, outputs, frame.width, frame.height, capturedRgba);
        } catch (error) {
          console.error('[worklet] Frame Processor Error:', error);
        } finally {
          frame.dispose();
        }
      },
    }),
    [tfModel, captureRequest]
  );
  const frameOutput = useFrameOutput(frameOutputOptions);

  const isDrowsy = snapshot.level === DrowsinessLevel.DROWSY;

  // "Save Drowsy Images": when a drowsy episode starts, ask the worklet for a snapshot.
  useEffect(() => {
    if (!isDrowsy || !settings.saveDrowsyImages || !uid) return;
    const now = Date.now();
    if (now - lastSavedAtRef.current < MIN_SAVE_INTERVAL_MS) return;
    lastSavedAtRef.current = now;
    captureRequest.setBlocking(true);
  }, [isDrowsy, settings.saveDrowsyImages, uid, captureRequest]);

  // "No Face Detected Alert": only after the face has been missing for a few seconds.
  useEffect(() => {
    if (!settings.noFaceAlert || snapshot.level !== DrowsinessLevel.NO_FACE || modelHook.state !== 'loaded') {
      setNoFaceAlertOn(false);
      return;
    }
    const t = setTimeout(() => setNoFaceAlertOn(true), NO_FACE_ALERT_AFTER_MS);
    return () => {
      clearTimeout(t);
      setNoFaceAlertOn(false);
    };
  }, [settings.noFaceAlert, snapshot.level, modelHook.state]);

  // Beep + vibrate while drowsy (or while the no-face alert is on): fire at once, then
  // repeat. Duration and the sound / vibration switches come from Settings. Driven by the
  // alert state CHANGING, not by every frame, so sounds can't pile up.
  const alertActive = isDrowsy || noFaceAlertOn;
  useEffect(() => {
    if (!alertActive) return;
    const durationMs = Math.round(settings.alertDurationSeconds * 1000);
    const fireAlert = () => {
      if (settings.alertSound) playAlertBeep(durationMs);
      if (settings.vibration) Vibration.vibrate(durationMs);
    };
    fireAlert();
    const id = setInterval(fireAlert, durationMs + ALERT_GAP_MS);
    return () => {
      clearInterval(id);
      Vibration.cancel();
      stopAlertBeep(); // silence immediately, don't let it finish playing
    };
  }, [alertActive, settings.alertSound, settings.vibration, settings.alertDurationSeconds]);

  // Map the normalized face box onto the screen, assuming the preview uses
  // resizeMode="cover" (scale to fill, crop the overflow, centered).
  const boxStyle = useMemo(() => {
    if (!faceBox || viewSize.w === 0 || viewSize.h === 0) return null;
    const scale = Math.max(viewSize.w / faceBox.frameW, viewSize.h / faceBox.frameH);
    const dispW = faceBox.frameW * scale;
    const dispH = faceBox.frameH * scale;
    const offX = (viewSize.w - dispW) / 2;
    const offY = (viewSize.h - dispH) / 2;

    let left = faceBox.x0 * dispW + offX;
    let right = faceBox.x1 * dispW + offX;
    if (MIRROR_BOX) {
      const l = viewSize.w - right;
      const r = viewSize.w - left;
      left = l;
      right = r;
    }
    const top = faceBox.y0 * dispH + offY;
    const bottom = faceBox.y1 * dispH + offY;
    return { left, top, width: right - left, height: bottom - top };
  }, [faceBox, viewSize]);

  const onLayout = (e: LayoutChangeEvent) =>
    setViewSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.centerText}>No front camera found</Text>
      </View>
    );
  }

  const boxColor = isDrowsy ? RED : GREEN;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[frameOutput]}
        onError={(e) => console.error('Camera onError:', e.message, e)}
      />

      {modelHook.state !== 'loaded' && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.text}>Model Loading...</Text>
        </View>
      )}

      {modelHook.state === 'loaded' && boxStyle && (
        <View pointerEvents="none" style={[styles.faceBox, boxStyle, { borderColor: boxColor }]} />
      )}

      {modelHook.state === 'loaded' && snapshot.level === DrowsinessLevel.NO_FACE && (
        <View pointerEvents="none" style={styles.noFaceOverlay}>
          <Text style={styles.noFaceText}>FACE</Text>
          <Text style={styles.noFaceText}>NOT DETECTED</Text>
          <View style={styles.noFaceLine} />
        </View>
      )}

      {modelHook.state === 'loaded' && isDrowsy && (
        <View pointerEvents="none" style={styles.warningBanner}>
          <Text style={styles.warningIcon}>⚠</Text>
          <Text style={styles.warningText}>DROWSINESS DETECTED</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centerText: { color: 'white', alignSelf: 'center', marginTop: 50 },
  loadingOverlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center',
  },
  text: { color: 'white', fontSize: 16, marginBottom: 4 },
  faceBox: {
    position: 'absolute',
    borderWidth: 4,
    borderRadius: 16,
  },
  noFaceOverlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center',
  },
  noFaceText: {
    color: 'white',
    fontSize: 40,
    letterSpacing: 8,
    textAlign: 'center',
    // Built-in thin/ultralight system fonts: no font files or native linking needed.
    fontFamily: Platform.select({ ios: 'HelveticaNeue-UltraLight', android: 'sans-serif-thin', default: undefined }),
    fontWeight: '200',
  },
  noFaceLine: { width: 56, height: 1, backgroundColor: 'rgba(255,255,255,0.7)', marginTop: 20 },
  warningBanner: {
    position: 'absolute', top: 60, left: 20, right: 20,
    backgroundColor: 'rgba(239,68,68,0.92)', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  warningIcon: { color: 'white', fontSize: 28, marginRight: 10 },
  warningText: { color: 'white', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 },
});