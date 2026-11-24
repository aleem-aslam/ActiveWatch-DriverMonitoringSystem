import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';

import {
  Camera,
  useCameraDevice,
  useFrameOutput,
  type Frame,
} from 'react-native-vision-camera';

import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import { useBundledModel } from '../ml/useBundledModel';
import LoadingSpinner from './LoadingSpinner';

import {
  preprocessFrame,
  floatRgbToRgba,
  MODEL_INPUT_SIZE,
} from '../ml/framePreprocessor';

import { runFaceLandmarkModel } from '../ml/drowsinessDetector';
import { isFaceGeometryPlausible } from '../ml/faceValidator';
import { calculateEAR } from '../ml/earCalculator';
import { DrowsinessStateMachine } from '../ml/drowsinessState';
import { configFromSettings } from '../ml/detectionConfig';

import {
  DrowsinessLevel,
  type DrowsinessSnapshot,
} from '../../types';

import {
  loadAlertSound,
  playAlertBeep,
  stopAlertBeep,
  unloadAlertSound,
} from '../services/beepAlert';

import {
  loadSoftSound,
  playSoftChime,
  unloadSoftSound,
} from '../services/softAlert';

import { DistractionTracker } from '../ml/distractionTracker';

import { useSettings } from '../hooks/useSettings';
import { rgbaToJpegBase64 } from '../utils/jpegBase64';
import { saveDrowsyEvent } from '../firebase/drowsyEventService';
import { pushFleetEvent } from '../firebase/fleetService';
import { recordEvent } from '../services/tripStore';


// MODEL CONFIGURATION

const MODEL_ASSET = require('../assets/models/face_landmark.tflite');

const MIRROR_BOX = true;

const GREEN = '#22c55e';
const RED = '#ef4444';

const MIN_SAVE_INTERVAL_MS = 10000;
const ALERT_GAP_MS = 800;
const SOFT_CHIME_INTERVAL_MS = 3000;


// FACE BOX TYPES


type FaceBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  frameW: number;
  frameH: number;
};

type DistractionStatus = 'ok' | 'looking_away' | 'no_face';


// FACE BOUNDING BOX CALCULATION


function computeFaceBox(
  landmarks: any[],
  frameW: number,
  frameH: number
): FaceBox | null {
  if (!landmarks || landmarks.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const div =
    Math.max(maxX, maxY) > 2
      ? MODEL_INPUT_SIZE
      : 1;

  const padX = ((maxX - minX) / div) * 0.1;
  const padY = ((maxY - minY) / div) * 0.1;

  const clamp = (v: number) =>
    Math.max(0, Math.min(1, v));

  const side = Math.min(frameW, frameH);

  const cropX0 = (frameW - side) / 2;
  const cropY0 = (frameH - side) / 2;

  const toFrameX = (nx: number) =>
    clamp((cropX0 + nx * side) / frameW);

  const toFrameY = (ny: number) =>
    clamp((cropY0 + ny * side) / frameH);

  return {
    x0: toFrameX(minX / div - padX),
    y0: toFrameY(minY / div - padY),
    x1: toFrameX(maxX / div + padX),
    y1: toFrameY(maxY / div + padY),
    frameW,
    frameH,
  };
}


// DRIVER MONITOR SCREEN


export default function DriverMonitorScreen() {


  // CAMERA AND SETTINGS


  const device = useCameraDevice('front');

  const { settings, uid } = useSettings();

  const modelHook = useBundledModel(MODEL_ASSET);
  const tfModel = modelHook.model;


  // DROWSINESS STATE


  const [snapshot, setSnapshot] =
    useState<DrowsinessSnapshot>({
      level: DrowsinessLevel.NO_FACE,
      ear: 0,
      eyesClosedForMs: 0,
      faceScore: 0,
      timestamp: Date.now(),
    });

  const [faceBox, setFaceBox] =
    useState<FaceBox | null>(null);

  const [viewSize, setViewSize] =
    useState({ w: 0, h: 0 });


  // DISTRACTION DETECTION STATE


  const distractionRef = useRef(
    new DistractionTracker()
  );

  const [distraction, setDistraction] =
    useState<DistractionStatus>('ok');


  // INTERNAL REFERENCES


  const stateMachineRef = useRef(
    new DrowsinessStateMachine()
  );

  const lastEarLogRef = useRef(0);
  const fpsFramesRef = useRef(0);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const uidRef = useRef(uid);
  uidRef.current = uid;

  const lastSnapshotRef =
    useRef<DrowsinessSnapshot | null>(null);

  const lastSavedAtRef = useRef(0);


  // FRAME CAPTURE REQUEST


  const captureRequest = useMemo(
    () => createSynchronizable(false),
    []
  );

  
  // LOAD AND UNLOAD ALERT SOUNDS
  

  useEffect(() => {

    // Load normal drowsiness / distraction beep.
    loadAlertSound();

    // Load soft no-face chime.
    loadSoftSound();

    return () => {

      // Stop any active alarm.
      stopAlertBeep();
      Vibration.cancel();

      // Release sound resources.
      unloadAlertSound();
      unloadSoftSound();
    };

  }, []);

  
  // APPLY DROWSINESS SETTINGS
  

  useEffect(() => {

    stateMachineRef.current.setConfig(
      configFromSettings(settings)
    );

  }, [
    settings.drowsinessSensitivity,
    settings.drowsinessTimeSeconds,
  ]);

  
  // SAVE DROWSINESS IMAGE
  

  async function handleCapturedImage(
    rgba: ArrayBuffer
  ) {

    const currentUid = uidRef.current;
    const s = settingsRef.current;

    if (!currentUid || !s.saveDrowsyImages) {
      return;
    }

    try {

      const imageBase64 = rgbaToJpegBase64(
        new Uint8Array(rgba),
        MODEL_INPUT_SIZE,
        MODEL_INPUT_SIZE,
        70
      );

      const snap = lastSnapshotRef.current;

      await saveDrowsyEvent(currentUid, {
        imageBase64,
        ear: snap?.ear ?? 0,
        eyesClosedForMs: Math.round(
          snap?.eyesClosedForMs ?? 0
        ),
        drowsyTimeSeconds:
          s.drowsinessTimeSeconds,
      });

      console.log(
        '[drowsy-image] saved to Firebase'
      );

    } catch (error) {

      console.warn(
        '[drowsy-image] failed to save:',
        error
      );

    }
  }

  
  // PROCESS FACE LANDMARK DATA ON JS THREAD
  

  function processFaceDataOnJS(
    outputs: ArrayBuffer[],
    frameW: number,
    frameH: number,
    capturedRgba: ArrayBuffer | null
  ) {

    if (capturedRgba) {
      handleCapturedImage(capturedRgba);
    }

    if (!outputs || outputs.length === 0) {
      return;
    }

    const nowMs = Date.now();

    
    // FACE LANDMARK DETECTION
    

    const face = runFaceLandmarkModel(outputs);

    const isValid = face
      ? isFaceGeometryPlausible(face)
      : false;

    
    // LOOKING-AWAY AND NO-FACE DETECTION
    

    const distractionState =
      distractionRef.current.update(
        face?.landmarks ?? null,
        isValid,
        nowMs
      );

    setDistraction(distractionState);

    
    // EYE ASPECT RATIO
    

    let currentEar = 0;

    if (isValid && face?.landmarks) {

      currentEar = calculateEAR(
        face.landmarks
      ).average;

    }

    
    // DROWSINESS STATE MACHINE
    

    const next =
      stateMachineRef.current.update(
        currentEar,
        face?.faceScore || 0,
        isValid,
        nowMs
      );

    lastSnapshotRef.current = next;

    
    // DIAGNOSTIC LOGGING
    

    fpsFramesRef.current += 1;

    if (nowMs - lastEarLogRef.current > 1000) {

      const fps =
        (fpsFramesRef.current * 1000) /
        (nowMs - lastEarLogRef.current);

      fpsFramesRef.current = 0;
      lastEarLogRef.current = nowMs;

      console.log(
        `[EAR] fps=${fps.toFixed(1)} ` +
        `ear=${currentEar.toFixed(3)} ` +
        `level=${next.level} ` +
        `closedMs=${Math.round(next.eyesClosedForMs)} ` +
        `valid=${isValid} ` +
        `distraction=${distractionState}`
      );

    }

    
    // UPDATE UI
    

    setSnapshot(next);

    setFaceBox(
      isValid &&
      face?.landmarks &&
      next.level !== DrowsinessLevel.NO_FACE
        ? computeFaceBox(
            face.landmarks,
            frameW,
            frameH
          )
        : null
    );

  }

  
  // CAMERA FRAME PROCESSING
  

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

          const outputs = tfModel.runSync([
            input.buffer as ArrayBuffer,
          ]);

          let capturedRgba:
            ArrayBuffer | null = null;

          // Capture a frame when requested.
          if (captureRequest.getBlocking()) {

            captureRequest.setBlocking(false);

            capturedRgba =
              floatRgbToRgba(input)
                .buffer as ArrayBuffer;

          }

          scheduleOnRN(
            processFaceDataOnJS,
            outputs,
            frame.width,
            frame.height,
            capturedRgba
          );

        } catch (error) {

          console.error(
            '[worklet] Frame Processor Error:',
            error
          );

        } finally {

          frame.dispose();

        }

      },

    }),
    [tfModel, captureRequest]
  );

  const frameOutput =
    useFrameOutput(frameOutputOptions);

  
  // DETECTION STATUS
  

  const isDrowsy =
    snapshot.level === DrowsinessLevel.DROWSY;

  const isLookingAway =
    distraction === 'looking_away';

  const isNoFace =
    distraction === 'no_face';

  // Normal warning for drowsiness or looking away.
  // No-face detection uses its own soft chime.
  const alertActive =
    isDrowsy || isLookingAway;

  
  // CAPTURE DROWSINESS SNAPSHOT
  

  useEffect(() => {

    if (
      !isDrowsy ||
      !settings.saveDrowsyImages ||
      !uid
    ) {
      return;
    }

    const now = Date.now();

    if (
      now - lastSavedAtRef.current <
      MIN_SAVE_INTERVAL_MS
    ) {
      return;
    }

    lastSavedAtRef.current = now;

    captureRequest.setBlocking(true);

  }, [
    isDrowsy,
    settings.saveDrowsyImages,
    uid,
    captureRequest,
  ]);

  
  // RECORD DROWSINESS EVENT
  

  const wasDrowsyRef = useRef(false);

  useEffect(() => {

    const rising =
      isDrowsy && !wasDrowsyRef.current;

    wasDrowsyRef.current = isDrowsy;

    if (!rising) {
      return;
    }

    // Store event in trip history.
    recordEvent('drowsy');

    // Send event to fleet dashboard.
    if (uid) {

      pushFleetEvent(uid, {

        type: 'DROWSY',

        occurredAtIso:
          new Date().toISOString(),

        detail:
          `eyes closed ${
            Math.round(
              lastSnapshotRef.current
                ?.eyesClosedForMs ?? 0
            )
          } ms`,

      });

    }

  }, [isDrowsy, uid]);

  
  // NORMAL ALARM: DROWSINESS + LOOKING AWAY
  

  useEffect(() => {

    if (!alertActive) {
      return;
    }

    const durationMs = Math.round(
      settings.alertDurationSeconds * 1000
    );

    const fireAlert = () => {

      if (settings.alertSound) {
        playAlertBeep(durationMs);
      }

      if (settings.vibration) {
        Vibration.vibrate(durationMs);
      }

    };

    // Trigger immediately.
    fireAlert();

    // Repeat while warning remains active.
    const id = setInterval(
      fireAlert,
      durationMs + ALERT_GAP_MS
    );

    return () => {

      clearInterval(id);

      Vibration.cancel();

      // Silence the beep when the warning clears.
      stopAlertBeep();

    };

  }, [
    alertActive,
    settings.alertSound,
    settings.vibration,
    settings.alertDurationSeconds,
  ]);

  
  // SOFT NO-FACE ALERT
  

  useEffect(() => {

    // Respect the No Face Detected Alert setting.
    if (!settings.noFaceAlert) {
      return;
    }

    // The tracker determines when the face has
    // been missing long enough.
    if (!isNoFace) {
      return;
    }

    // Only play when the face model is loaded.
    if (modelHook.state !== 'loaded') {
      return;
    }

    // Avoid overlapping the soft chime with
    // the normal drowsiness/distraction alarm.
    if (alertActive) {
      return;
    }

    // Respect the global sound setting.
    if (!settings.alertSound) {
      return;
    }

    // Play the first soft chime immediately.
    playSoftChime();

    // Repeat the soft chime every 3 seconds
    // while the no-face condition continues.
    const id = setInterval(() => {

      playSoftChime();

    }, SOFT_CHIME_INTERVAL_MS);

    return () => {

      clearInterval(id);

    };

  }, [
    isNoFace,
    settings.noFaceAlert,
    settings.alertSound,
    modelHook.state,
    alertActive,
  ]);

  
  // CALCULATE FACE BOX POSITION
  

  const boxStyle = useMemo(() => {

    if (
      !faceBox ||
      viewSize.w === 0 ||
      viewSize.h === 0
    ) {
      return null;
    }

    const scale = Math.max(
      viewSize.w / faceBox.frameW,
      viewSize.h / faceBox.frameH
    );

    const dispW = faceBox.frameW * scale;
    const dispH = faceBox.frameH * scale;

    const offX =
      (viewSize.w - dispW) / 2;

    const offY =
      (viewSize.h - dispH) / 2;

    let left =
      faceBox.x0 * dispW + offX;

    let right =
      faceBox.x1 * dispW + offX;

    if (MIRROR_BOX) {

      const l = viewSize.w - right;
      const r = viewSize.w - left;

      left = l;
      right = r;

    }

    const top =
      faceBox.y0 * dispH + offY;

    const bottom =
      faceBox.y1 * dispH + offY;

    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };

  }, [faceBox, viewSize]);

  
  // CAMERA LAYOUT
  

  const onLayout = (
    e: LayoutChangeEvent
  ) => {

    setViewSize({
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    });

  };

  
  // NO CAMERA AVAILABLE
  

  if (!device) {

    return (

      <View style={styles.container}>
        <Text style={styles.centerText}>
          No front camera found
        </Text>
      </View>

    );

  }

  
  // UI WARNING STATUS
  

  const boxColor =
    alertActive ? RED : GREEN;

  const warningMessage =
    isDrowsy
      ? 'DROWSINESS DETECTED'
      : 'LOOKING AWAY';

  // If a face disappears during a head turn,
  // show the distraction warning rather than
  // covering it with the no-face overlay.
  const showNoFaceOverlay =
    snapshot.level === DrowsinessLevel.NO_FACE &&
    !isLookingAway;

  
  // RENDER CAMERA SCREEN
  

  return (

    <View
      style={styles.container}
      onLayout={onLayout}
    >

      {/* FRONT CAMERA */}

      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[frameOutput]}
        onError={(e) =>
          console.error(
            'Camera onError:',
            e.message,
            e
          )
        }
      />

      {/* MODEL LOADING */}

      {modelHook.state !== 'loaded' && (

        <View style={styles.loadingOverlay}>

          {modelHook.state === 'error' ? (

            <Text style={styles.text}>

              Face model could not load
              {'\n'}

              {String(
                (modelHook as any).error?.message ??
                (modelHook as any).error ??
                ''
              )}

            </Text>

          ) : (

            <LoadingSpinner />

          )}

        </View>

      )}

      {/* FACE BOUNDING BOX */}

      {modelHook.state === 'loaded' &&
        boxStyle && (

          <View
            pointerEvents="none"
            style={[
              styles.faceBox,
              boxStyle,
              { borderColor: boxColor },
            ]}
          />

        )}

      {/* NO FACE DETECTED OVERLAY */}

      {modelHook.state === 'loaded' &&
        showNoFaceOverlay && (

          <View
            pointerEvents="none"
            style={styles.noFaceOverlay}
          >

            <Text style={styles.noFaceText}>
              FACE
            </Text>

            <Text style={styles.noFaceText}>
              NOT DETECTED
            </Text>

            <View style={styles.noFaceLine} />

          </View>

        )}

      {/* DROWSINESS / DISTRACTION WARNING */}

      {modelHook.state === 'loaded' &&
        alertActive && (

          <View
            pointerEvents="none"
            style={styles.warningBanner}
          >

            <Text style={styles.warningIcon}>
              ⚠
            </Text>

            <Text style={styles.warningText}>
              {warningMessage}
            </Text>

          </View>

        )}

    </View>

  );

}


// STYLES


const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: 'black',
  },

  centerText: {
    color: 'white',
    alignSelf: 'center',
    marginTop: 50,
  },

  loadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  text: {
    color: 'white',
    fontSize: 16,
    marginBottom: 4,
  },

  faceBox: {
    position: 'absolute',
    borderWidth: 4,
    borderRadius: 16,
  },

  noFaceOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  noFaceText: {
    color: 'white',
    fontSize: 40,
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'HelveticaNeue-UltraLight',
      android: 'sans-serif-thin',
      default: undefined,
    }),
    fontWeight: '200',
  },

  noFaceLine: {
    width: 56,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginTop: 20,
  },

  warningBanner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(239,68,68,0.92)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  warningIcon: {
    color: 'white',
    fontSize: 28,
    marginRight: 10,
  },

  warningText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    flexShrink: 1,
    textAlign: 'center',
  },

});
