// src/ml/collision/useRoadMonitor.ts
// Everything the road (rear) camera needs: loads YOLOv8, runs it on every frame in the
// frame worklet, decodes detections, finds the lane markings, and turns it all into a
// collision snapshot (tracks, speeds, path prediction, hard-braking).
// Returns a frame output to attach to the REAR camera, plus debug numbers and GPS state.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBundledModel } from '../useBundledModel';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';
import { frameToYoloInput, frameToRgba, decodeYolo, scanMaxRoadScore, sceneStats, type Detection } from './yoloDecoder';
import { detectLane, type LaneResult } from './laneDetector';
import { LaneDepartureMonitor, type DepartureState } from './laneDeparture';
import { TtcEstimator, type CollisionSnapshot } from './ttcEstimator';
import { usePerformanceGuard } from '../../hooks/usePerformanceGuard';
import { useOwnSpeed, type GpsFix } from '../../hooks/useOwnSpeed';
import type { LaneInfo } from '../../hooks/useMountCheck';

const YOLO_MODEL = require('../../assets/models/yolov8n.tflite');

const EMPTY: CollisionSnapshot = {
  level: 'SAFE', ttcSeconds: null, distanceMeters: null, target: null,
  reason: 'NONE', message: '', leadSpeedKmh: null, youBraking: false, headwaySeconds: null, tracks: [],
};

export type Visibility = 'normal' | 'night' | 'lowvis';
// what each visibility mode does to detection
const GAIN: Record<Visibility, number> = { normal: 1, night: 1.8, lowvis: 1.3 };
const SCORE_THRESHOLD: Record<Visibility, number> = { normal: 0.4, night: 0.28, lowvis: 0.32 };
const LANE_EVERY_NORMAL = 3;
const LANE_EVERY_ECO = 9;

const PHOTO_WIDTH_PX = 360;
const LANE_MIN_CONFIDENCE = 0.5;
const LANE_SMOOTHING = 0.15; // per update; slow on purpose so a bend does not move "straight ahead"
const LANE_STALE_MS = 4000;

export type RoadDetections = { list: Detection[]; w: number; h: number };
export type RoadDebug = {
  fps: number;
  count: number; // detections in the last frame
  bestScore: number; // highest road-class score in the last frame
  outShape: string;
  inSize: number;
};
/** Called on the JS thread with the picture the worklet grabbed after requestPhoto(). */
export type PhotoHandler = (rgba: ArrayBuffer, width: number, height: number) => void;

export type RoadMonitorOptions = {
  /** Test mode: pretend your own speed is this (km/h) instead of using GPS. null = use GPS. */
  overrideSpeedKmh?: number | null;
  /** Distance calibration factor from the calibration screen (1 = none). */
  distanceScale?: number;
  followingWarning?: boolean;
  followingGapSeconds?: number;
  laneDepartureWarning?: boolean;
  nightMode?: 'auto' | 'on' | 'off';
};

export function useRoadMonitor(ttcThresholdSeconds: number, onPhoto?: PhotoHandler, opts?: RoadMonitorOptions) {
  const hook = useBundledModel(YOLO_MODEL);
  const model = hook.model;
  const gps = useOwnSpeed();

  const [road, setRoad] = useState<CollisionSnapshot>(EMPTY);
  const [dets, setDets] = useState<RoadDetections>({ list: [], w: 1, h: 1 });
  const [lane, setLane] = useState<LaneResult | null>(null);
  const [laneInfo, setLaneInfo] = useState<LaneInfo | null>(null);
  const [debug, setDebug] = useState<RoadDebug>({ fps: 0, count: 0, bestScore: 0, outShape: '-', inSize: 0 });
  const estimator = useRef(new TtcEstimator()).current;
  const frames = useRef(0);
  const last = useRef({ count: 0, best: 0 });
  const laneSmooth = useRef<{ vpX: number; vpY: number; at: number } | null>(null);
  const depMon = useRef(new LaneDepartureMonitor()).current;
  const [departure, setDeparture] = useState<DepartureState>('LEARNING');
  const departureRef = useRef<DepartureState>('LEARNING');
  const [visibility, setVisibility] = useState<Visibility>('normal');
  const vis = useRef({ mode: 'normal' as Visibility, mean: 0.5, std: 0.2, cand: 'normal' as Visibility, candSince: 0 });
  const optsRef = useRef<RoadMonitorOptions>(opts ?? {});
  optsRef.current = opts ?? {};

  // The frame callback below is created once, so everything it reaches must be a ref.
  const photoRef = useRef<PhotoHandler | undefined>(onPhoto);
  photoRef.current = onPhoto;
  const getSpeedRef = useRef(gps.getSpeedMps);
  getSpeedRef.current = gps.getSpeedMps;
  const getDecelRef = useRef(gps.getOwnDecelMps2);
  getDecelRef.current = gps.getOwnDecelMps2;
  const getFixRef = useRef(gps.getFix);
  getFixRef.current = gps.getFix;
  const overrideRef = useRef<number | null>(opts?.overrideSpeedKmh ?? null);
  overrideRef.current = opts?.overrideSpeedKmh ?? null;
  const roadRef = useRef<CollisionSnapshot>(EMPTY);

  // JS -> worklet flag: "send me the next frame as a picture".
  const photoRequest = useMemo(() => createSynchronizable(false), []);
  const requestPhoto = useCallback(() => photoRequest.setBlocking(true), [photoRequest]);
  // worklet-side frame counter, so the lane finder runs on every Nth frame only
  const laneTick = useMemo(() => createSynchronizable(0), []);
  const laneEvery = useMemo(() => createSynchronizable(LANE_EVERY_NORMAL), []);
  // night mode: picture gain and detection threshold the worklet reads on every frame
  const gainSync = useMemo(() => createSynchronizable(1), []);
  const thrSync = useMemo(() => createSynchronizable(SCORE_THRESHOLD.normal), []);

  useEffect(() => {
    estimator.setConfig({
      ttcThresholdSeconds,
      followingEnabled: opts?.followingWarning ?? true,
      followingGapSeconds: opts?.followingGapSeconds ?? 1.5,
    });
    estimator.setDistanceScale(opts?.distanceScale ?? 1);
  }, [estimator, ttcThresholdSeconds, opts?.followingWarning, opts?.followingGapSeconds, opts?.distanceScale]);

  // heat / slow-down guard: in eco mode the lane finder runs less often
  const perf = usePerformanceGuard(debug.fps, ready0(hook.state));
  useEffect(() => {
    laneEvery.setBlocking(perf.eco ? LANE_EVERY_ECO : LANE_EVERY_NORMAL);
  }, [perf.eco, laneEvery]);

  // night mode forced on/off from Settings (auto is decided from the picture in onResult)
  useEffect(() => {
    const m = opts?.nightMode ?? 'auto';
    if (m === 'on') applyVisibility('night');
    else if (m === 'off') applyVisibility('normal');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.nightMode]);

  function applyVisibility(mode: Visibility) {
    if (vis.current.mode === mode) return;
    vis.current.mode = mode;
    gainSync.setBlocking(GAIN[mode]);
    thrSync.setBlocking(SCORE_THRESHOLD[mode]);
    setVisibility(mode);
  }

  // Real tensor shapes from the loaded model (falls back to the usual 320 / [1,84,N]).
  const info = useMemo(() => {
    const m: any = model;
    const inShape = m?.inputs?.[0]?.shape;
    const outShape = m?.outputs?.[0]?.shape;
    // Input is [1,H,W,3] (NHWC) or [1,3,H,W] (NCHW). Read the real layout.
    let size = 320;
    let channelsFirst = false;
    if (Array.isArray(inShape) && inShape.length === 4) {
      channelsFirst = inShape[1] === 3 && inShape[3] !== 3;
      size = (channelsFirst ? inShape[2] : inShape[1]) as number;
      if (!(size > 3)) size = 320;
    }
    return {
      size,
      channelsFirst,
      outShape: Array.isArray(outShape) ? (outShape as number[]) : null,
    };
  }, [model]);

  useEffect(() => {
    if (hook.state === 'error') console.error('[yolo] model failed to load:', (hook as any).error);
  }, [hook.state]);

  useEffect(() => {
    if (!model) return;
    const m: any = model;
    console.log('[yolo] inputs', JSON.stringify(m.inputs), 'outputs', JSON.stringify(m.outputs));
  }, [model]);

  // once a second: processed frames/s and what the model last saw
  useEffect(() => {
    const id = setInterval(() => {
      setDebug({
        fps: frames.current,
        count: last.current.count,
        bestScore: last.current.best,
        outShape: info.outShape ? '[' + info.outShape.join(',') + ']' : 'unknown',
        inSize: info.size,
      });
      frames.current = 0;
    }, 1000);
    return () => clearInterval(id);
  }, [info]);

  // Plain JS function on the JS thread, called from the worklet via scheduleOnRN.
  function onResult(
    list: Detection[], w: number, h: number, bestScore: number,
    rgba: ArrayBuffer | null, pw: number, ph: number,
    laneRan: boolean, laneRes: LaneResult | null,
    mean: number, std: number, frameTimeMs: number
  ) {
    frames.current += 1;
    last.current = { count: list.length, best: bestScore };
    // Time of the frame taken on the worklet thread. The JS thread can be busy and deliver results
    // in bursts, which would make speeds (distance / time) jump around if we used Date.now() here.
    const now = frameTimeMs > 0 ? frameTimeMs : Date.now();

    // lane -> where "straight ahead" is in the picture (slow smoothing)
    if (laneRan) {
      if (laneRes && laneRes.confidence >= LANE_MIN_CONFIDENCE) {
        const s = laneSmooth.current;
        laneSmooth.current = s
          ? { vpX: s.vpX + (laneRes.vpX - s.vpX) * LANE_SMOOTHING, vpY: s.vpY + (laneRes.vpY - s.vpY) * LANE_SMOOTHING, at: now }
          : { vpX: laneRes.vpX, vpY: laneRes.vpY, at: now };
        setLane(laneRes);
        setLaneInfo({ vpX: laneSmooth.current.vpX, vpY: laneSmooth.current.vpY, confidence: laneRes.confidence, at: now });
      } else if (laneSmooth.current && now - laneSmooth.current.at > LANE_STALE_MS) {
        laneSmooth.current = null;
        setLane(null);
        setLaneInfo(null);
      }
    }
    // lane departure (uses the raw lane result, only when the lane finder ran)
    if (laneRan) {
      const ov0 = overrideRef.current;
      const mps = getSpeedRef.current();
      const sp = ov0 !== null ? ov0 : mps !== null ? mps * 3.6 : null;
      const st = depMon.update(laneRes, now, sp, optsRef.current.laneDepartureWarning ?? true);
      if (st !== departureRef.current) {
        departureRef.current = st;
        setDeparture(st);
      }
    }

    // night / low-visibility: decide from brightness (mean) and contrast (std) of the picture
    const mode = optsRef.current.nightMode ?? 'auto';
    if (mode === 'auto') {
      const v = vis.current;
      v.mean = v.mean * 0.9 + mean * 0.1;
      v.std = v.std * 0.9 + std * 0.1;
      const cur = v.mode;
      let cand: Visibility;
      if (cur === 'night') cand = v.mean > 0.32 ? (v.std < 0.09 ? 'lowvis' : 'normal') : 'night';
      else if (v.mean < 0.25) cand = 'night';
      else if (cur === 'lowvis') cand = v.std > 0.11 ? 'normal' : 'lowvis';
      else cand = v.std < 0.09 ? 'lowvis' : 'normal';
      if (cand !== v.cand) {
        v.cand = cand;
        v.candSince = now;
      }
      const wait = cand === 'normal' ? 5000 : 3000;
      if (cand !== cur && now - v.candSince >= wait) applyVisibility(cand);
    }

    const fresh = laneSmooth.current && now - laneSmooth.current.at <= LANE_STALE_MS ? laneSmooth.current : null;
    estimator.setPathCenter(fresh ? fresh.vpX : null);

    // your own speed / braking: GPS, or the test-mode value
    const ov = overrideRef.current;
    estimator.setOwnSpeed(ov !== null ? ov / 3.6 : getSpeedRef.current());
    estimator.setOwnDecel(ov !== null ? 0 : getDecelRef.current());

    const snap = estimator.update(list, now, w / h);
    roadRef.current = snap;
    setDets({ list, w, h });
    setRoad(snap);
    if (rgba && photoRef.current) photoRef.current(rgba, pw, ph);
  }

  const options = useMemo(() => {
    const size = info.size;
    const channelsFirst = info.channelsFirst;
    const outShape = info.outShape;
    return {
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
          const stats = sceneStats(frame);
          const frameTime = Date.now();
          const input = frameToYoloInput(frame, size, channelsFirst, gainSync.getBlocking());
          const outputs = model.runSync([input.buffer as ArrayBuffer]);
          const raw = new Float32Array(outputs[0] as ArrayBuffer);
          const shape = outShape ?? [1, 84, raw.length / 84];
          const list = decodeYolo(raw, shape, size, thrSync.getBlocking());
          const best = scanMaxRoadScore(raw, shape);

          // lane markings on every Nth frame
          const tick = laneTick.getBlocking() + 1;
          laneTick.setBlocking(tick);
          let laneRan = false;
          let laneRes: LaneResult | null = null;
          if (tick % laneEvery.getBlocking() === 0) {
            laneRan = true;
            laneRes = detectLane(frame);
          }

          // If JS asked for an incident photo, send this exact frame along (once).
          let rgba: ArrayBuffer | null = null;
          let pw = 0;
          let ph = 0;
          if (photoRequest.getBlocking()) {
            photoRequest.setBlocking(false);
            const pic = frameToRgba(frame, PHOTO_WIDTH_PX);
            rgba = pic.rgba;
            pw = pic.w;
            ph = pic.h;
          }
          scheduleOnRN(onResult, list, frame.width, frame.height, best, rgba, pw, ph, laneRan, laneRes, stats.mean, stats.std, frameTime);
        } catch (error) {
          console.error('[road worklet]', error);
        } finally {
          frame.dispose();
        }
      },
    };
  }, [model, info, photoRequest, laneTick, laneEvery, gainSync, thrSync]);

  const getRoad = useCallback(() => roadRef.current, []);
  const getFix = useCallback((): GpsFix | null => getFixRef.current(), []);

  const roadOutput = useFrameOutput(options);
  return {
    roadOutput,
    road,
    dets,
    lane,
    laneInfo,
    departure,
    offsetLanes: depMon.offsetLanes,
    visibility,
    perf,
    debug,
    modelState: hook.state,
    modelError: hook.state === 'error' ? String((hook as any).error?.message ?? (hook as any).error ?? 'unknown error') : null,
    ready: hook.state === 'loaded',
    requestPhoto,
    getRoad,
    getFix,
    gps: { speedKmh: gps.speedKmh, status: gps.status },
  };
}

function ready0(state: string) {
  return state === 'loaded';
}