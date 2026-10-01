import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

export default function CameraScreen() {
  // const { state: modelState, model } = useDrowsinessModel();
  const [model,setModel] = useState<any>(null);
  const device = useCameraDevice('front');
  const cameraRef = useRef<CameraRef>(null);
  const photoOutput = usePhotoOutput({
  containerFormat: 'jpeg',
  quality: 0.6,
  qualityPrioritization: device?.supportsSpeedQualityPrioritization ? 'speed' : 'balanced',
  targetResolution: { width: 640, height: 480 }, // plenty for a 192x192 crop, much cheaper to rotate
});

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

  useEffect(() => {
    loadAlertSound();
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      unloadAlertSound();
    };
  }, []);

  useEffect(()=>{

async function init(){

try{

const loaded = await loadFaceModel();
setModel(loaded);
}
catch(e){

console.log("MODEL ERROR",e);
}
}
init();
},[]);

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
      // RN's setTimeout typing wants a zero-arg callback; `resolve` takes one.
      await new Promise<void>((resolve) => setTimeout(() => resolve(), wait));
    }
  }

  async function runOneCycle() {
    if (!model) return;

    // was: captureAndPreprocess(cameraRef, ...) — capture now goes through
    // the CameraPhotoOutput, not the camera ref (V5 API)
    const captured = await captureAndPreprocess(photoOutput, trackedRoiRef.current);
    if (!captured) return;

    // fast-tflite v3 (Nitro) takes/returns raw ArrayBuffers, not typed arrays
    const outputs = await model.run([captured.input.buffer as ArrayBuffer]);
    const face = runFaceLandmarkModel(outputs);
    console.log("FACE RESULT",face);
    const isValid = isFaceGeometryPlausible(face);

    if (isValid) {
      const cropRoi =
        trackedRoiRef.current ?? {
          x: (captured.frameWidth - Math.min(captured.frameWidth, captured.frameHeight)) / 2,
          y: (captured.frameHeight - Math.min(captured.frameWidth, captured.frameHeight)) / 2,
          size: Math.min(captured.frameWidth, captured.frameHeight),
        };
      trackedRoiRef.current = roiFromLandmarks(
        new Float32Array(outputs[0]), // was: outputs[0] as Float32Array
        cropRoi,
        captured.frameWidth,
        captured.frameHeight
      );
    } else {
      trackedRoiRef.current = undefined; // fall back to centered crop next cycle
    }

    const ear =calculateEAR(face.landmarks).average;
    const next = stateMachineRef.current.update(ear, face.faceScore, isValid, Date.now());

    if (!mountedRef.current) return;
    setSnapshot(next);
    if (next.level === DrowsinessLevel.DROWSY) {
      playAlertBeep();
    }
  }

  if (!device) return <Text>No front camera found</Text>;
 if(!model || !device) return <Text>Model Loading...</Text>;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[photoOutput]}
      />
      <View style={styles.overlay}>
        <Text>
          Face Score:{snapshot.faceScore.toFixed(2)}
        </Text>
        <Text>
          State:{snapshot.level}
          </Text>
        <Text style={styles.text}>EAR: {snapshot.ear.toFixed(3)}</Text>
        <Text
          style={[styles.text, snapshot.level === DrowsinessLevel.DROWSY && styles.alertText]}
        >
          {snapshot.level}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 8,
  },
  text: { color: 'white', fontSize: 16 },
  alertText: { color: 'red', fontWeight: 'bold', fontSize: 20 },
});