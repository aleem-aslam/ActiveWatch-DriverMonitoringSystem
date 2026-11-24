// src/ml/useDriverMonitor.ts
// Driver-camera pipeline as a hook (face landmarks -> EAR -> drowsiness state machine).
// Used by the "Both" screen. The driver-only screen keeps using DriverCameraScreen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBundledModel } from './useBundledModel';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { preprocessFrame } from './framePreprocessor';
import { runFaceLandmarkModel } from './drowsinessDetector';
import { isFaceGeometryPlausible } from './faceValidator';
import { calculateEAR } from './earCalculator';
import { DrowsinessStateMachine } from './drowsinessState';
import { configFromSettings } from './detectionConfig';
import { DrowsinessLevel } from '../../types';

const FACE_MODEL = require('../assets/models/face_landmark.tflite');

export function useDriverMonitor(settings: { drowsinessSensitivity: number; drowsinessTimeSeconds: number }) {
  const hook = useBundledModel(FACE_MODEL);
  const model = hook.model;
  const [driver, setDriver] = useState<{ level: string; ear: number }>({ level: String(DrowsinessLevel.NO_FACE), ear: 0 });
  const machine = useRef(new DrowsinessStateMachine()).current;

  useEffect(() => {
    machine.setConfig(configFromSettings(settings));
  }, [machine, settings.drowsinessSensitivity, settings.drowsinessTimeSeconds]);

  function onResult(outputs: ArrayBuffer[]) {
    if (!outputs || outputs.length === 0) return;
    const f = runFaceLandmarkModel(outputs);
    const valid = f ? isFaceGeometryPlausible(f) : false;
    const ear = valid && f?.landmarks ? calculateEAR(f.landmarks).average : 0;
    const snap = machine.update(ear, f?.faceScore || 0, valid, Date.now());
    setDriver({ level: String(snap.level), ear });
  }

  const options = useMemo(
    () => ({
      pixelFormat: 'rgb' as const,
      dropFramesWhileBusy: true,
      enablePhysicalBufferRotation: true,
      onFrame(frame: Frame) {
        'worklet';
        if (model == null) {
          frame.dispose();
          return;
        }
        try {
          const input = preprocessFrame(frame);
          const outputs = model.runSync([input.buffer as ArrayBuffer]);
          scheduleOnRN(onResult, outputs);
        } catch (error) {
          console.error('[driver worklet]', error);
        } finally {
          frame.dispose();
        }
      },
    }),
    [model]
  );

  const faceOutput = useFrameOutput(options);
  return {
    faceOutput,
    driver,
    drowsy: driver.level === String(DrowsinessLevel.DROWSY),
    ready: hook.state === 'loaded',
  };
}