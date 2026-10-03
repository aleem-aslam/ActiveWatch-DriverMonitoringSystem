import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Camera, useCameraDevice, usePhotoOutput, type CameraRef } from 'react-native-vision-camera';
import { loadFaceModel, getFaceModel } from '../ml/tfliteLoader';
import { captureAndPreprocess } from './frameCapture';
import { roiFromLandmarks } from '../ml/imagePreprocessor';
import { runFaceLandmarkModel } from '../ml/drowsinessDetector';
import { isFaceGeometryPlausible } from '../ml/faceValidator';
import { calculateEAR } from '../ml/earCalculator';
import { DrowsinessStateMachine } from '../ml/drowsinessState';
import { DrowsinessLevel, type DrowsinessSnapshot, type Roi } from '../../types';
import { loadAlertSound, playAlertBeep, unloadAlertSound } from '../services/beepAlert';

// Target time between the START of one capture cycle and the next. The
// actual achieved rate will be lower than 1000/CYCLE_INTERVAL_MS whenever a
// cycle (snapshot + decode + inference) takes longer than this — the loop
// below accounts for that by scheduling from *completion* time, not with a
// fixed-rate setInterval, so cycles never stack up on a slow device.
const CYCLE_INTERVAL_MS = 125; // ~8/sec ceiling; real-world rate will vary

// Most front-camera previews are shown mirrored (like a mirror) even though
// the saved/captured photo usually is NOT mirrored. If the box below ends up
// on the wrong side of your face, flip this to false.
const MIRROR_PREVIEW = true;

/**
 * Maps a Roi expressed in captured-photo pixel space (frameW x frameH) onto
 * the on-screen rectangle it corresponds to, given the screen's size.
 * Assumes the preview uses VisionCamera's default resizeMode="cover".
 * This is pure math only — it is called during render and never touches
 * capture, inference, or state, so it cannot affect detection.
 */
function mapRoiToViewRect(
  roi: Roi,
  frameW: number,
  frameH: number,
  viewW: number,
  viewH: number
) {
  if (!frameW || !frameH || !viewW || !viewH) return null;

  const scale = Math.max(viewW / frameW, viewH / frameH);
  const offsetX = (viewW - frameW * scale) / 2;
  const offsetY = (viewH - frameH * scale) / 2;

  let left = roi.x * scale + offsetX;
  const top = roi.y * scale + offsetY;
  const size = roi.size * scale;

  if (MIRROR_PREVIEW) {
    left = viewW - (left + size);
  }

  return { left, top, width: size, height: size };
}

export default function CameraScreen() {
  const [model, setModel] = useState<any>(null);
  const device = useCameraDevice('front');
  const cameraRef = useRef<CameraRef>(null);
  // Read screen size directly instead of an onLayout+setState round trip —
  // same information, without adding an extra render near the camera.
  const { width: screenW, height: screenH } = useWindowDimensions();

  // `setSnapshot` re-renders this component every cycle, which previously
  // recreated this whole options object (and its nested targetResolution
  // object) on every render. If usePhotoOutput treats a changed options
  // reference as "rebuild the output," that tears down and rebinds the
  // native photo pipeline constantly -- which matches the logs showing
  // some cycles capturing fine and others failing moments later.
  const photoOutputOptions = useMemo(
    () => ({
      containerFormat: 'jpeg' as const,
      quality: 0.6,
      qualityPrioritization: (device?.supportsSpeedQualityPrioritization ? 'speed' : 'balanced') as
        | 'speed'
        | 'balanced',
      targetResolution: { width: 640, height: 480 }, // plenty for a 192x192 crop, much cheaper to rotate
    }),
    [device?.supportsSpeedQualityPrioritization]
  );
  const photoOutput = usePhotoOutput(photoOutputOptions);
  // Stable array reference for the `outputs` prop. `outputs={[photoOutput]}`
  // would otherwise create a brand-new array every render; memoizing avoids
  // handing the native camera a "changed" outputs list when nothing
  // actually changed.
  const outputs = useMemo(() => [photoOutput], [photoOutput]);

  const [snapshot, setSnapshot] = useState<DrowsinessSnapshot>({
    level: DrowsinessLevel.NO_FACE,
    ear: 0,
    eyesClosedForMs: 0,
    faceScore: 0,
    timestamp: Date.now(),
  });

  const stateMachineRef = useRef(new DrowsinessStateMachine());
  const trackedRoiRef = useRef<Roi | undefined>(undefined);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const frameSizeRef = useRef({ width: 0, height: 0 });
  // `device` is available almost immediately, but the native camera session
  // takes a bit longer to actually bind. Capturing before that finishes is
  // what throws "Not bound to a valid Camera" / "session/camera-not-ready".
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    loadAlertSound();
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      unloadAlertSound();
    };
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const loaded = await loadFaceModel();
        setModel(loaded);
      } catch (e) {
        console.log('MODEL ERROR', e);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (model && device && cameraReady) {
      runningRef.current = true;
      runLoop();
    }
    return () => {
      runningRef.current = false;
    };
  }, [model, device, cameraReady]);

  async function runLoop() {
    while (runningRef.current && mountedRef.current) {
      const cycleStart = Date.now();
      try {
        await runOneCycle();
      } catch (e) {
        // A single failed cycle (camera busy, decode hiccup) shouldn't kill
        // the loop — just skip this cycle and keep going.
        console.warn('Drowsiness detection cycle failed:', e);
      }
      const elapsed = Date.now() - cycleStart;
      const wait = Math.max(0, CYCLE_INTERVAL_MS - elapsed);
      await new Promise<void>((resolve) => setTimeout(() => resolve(), wait));
    }
  }

  async function runOneCycle() {
    if (!model) return;
    // onStarted means the CameraSession overall has begun, but this specific
    // output can finish attaching slightly later. currentResolution is
    // documented as undefined until this output is connected to the
    // session -- check it directly instead of assuming onStarted covers it.
    if (!photoOutput.currentResolution) {
      console.log('Photo output not connected to the session yet, skipping cycle');
      return;
    }

    const captured = await captureAndPreprocess(photoOutput, trackedRoiRef.current);
    if (!captured) return;
    frameSizeRef.current = { width: captured.frameWidth, height: captured.frameHeight };

    // fast-tflite v3 (Nitro) takes/returns raw ArrayBuffers, not typed arrays
    const modelOutputs = await model.run([captured.input.buffer as ArrayBuffer]);
    const face = runFaceLandmarkModel(modelOutputs);
    console.log('FACE RESULT', face);
    const isValid = isFaceGeometryPlausible(face);

    if (isValid) {
      const cropRoi =
        trackedRoiRef.current ?? {
          x: (captured.frameWidth - Math.min(captured.frameWidth, captured.frameHeight)) / 2,
          y: (captured.frameHeight - Math.min(captured.frameWidth, captured.frameHeight)) / 2,
          size: Math.min(captured.frameWidth, captured.frameHeight),
        };
      trackedRoiRef.current = roiFromLandmarks(
        new Float32Array(modelOutputs[0]),
        cropRoi,
        captured.frameWidth,
        captured.frameHeight
      );
    } else {
      trackedRoiRef.current = undefined; // fall back to centered crop next cycle
    }

    const ear = calculateEAR(face.landmarks).average;
    const next = stateMachineRef.current.update(ear, face.faceScore, isValid, Date.now());

    if (!mountedRef.current) return;
    setSnapshot(next);
    if (next.level === DrowsinessLevel.DROWSY) {
      playAlertBeep();
    }
  }

  if (!device) return <Text>No front camera found</Text>;
  if (!model) return <Text>Model Loading...</Text>;

  const boxRect = trackedRoiRef.current
    ? mapRoiToViewRect(
        trackedRoiRef.current,
        frameSizeRef.current.width,
        frameSizeRef.current.height,
        screenW,
        screenH
      )
    : null;

  const boxColor =
    snapshot.level === DrowsinessLevel.DROWSY
      ? '#ff3b30'
      : snapshot.level === DrowsinessLevel.WARNING
      ? '#ffcc00'
      : '#2ecc71';

  const showAlertBanner =
    snapshot.level === DrowsinessLevel.WARNING || snapshot.level === DrowsinessLevel.DROWSY;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={outputs}
        onStarted={() => setCameraReady(true)}
        onError={(e) => console.warn('Camera error', e)}
      />

      {boxRect && (
        <View
          pointerEvents="none"
          style={[
            styles.faceBox,
            {
              left: boxRect.left,
              top: boxRect.top,
              width: boxRect.width,
              height: boxRect.height,
              borderColor: boxColor,
            },
          ]}
        />
      )}

      {showAlertBanner && (
        <View
          pointerEvents="none"
          style={[
            styles.alertBanner,
            { backgroundColor: snapshot.level === DrowsinessLevel.DROWSY ? '#ff3b30' : '#ffcc00' },
          ]}
        >
          <Text style={styles.alertBannerText}>
            {snapshot.level === DrowsinessLevel.DROWSY
              ? '\u26A0 DROWSINESS DETECTED \u2014 WAKE UP'
              : '\u26A0 Eyes closing \u2014 stay alert'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  faceBox: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: 8,
  },
  alertBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48, // clears the status bar; adjust if you add a safe-area hook
    paddingBottom: 14,
    alignItems: 'center',
  },
  alertBannerText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
});