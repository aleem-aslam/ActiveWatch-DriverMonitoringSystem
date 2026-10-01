export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Output of landmarkProcessor.ts for one frame. */
export interface FaceResult {
  landmarks: Point3D[]; // 468 points, normalized 0..1 within the crop
  faceScore: number; // 0..1, already sigmoid'd
  isFacePresent: boolean;
}

export interface EyeAspectRatios {
  left: number;
  right: number;
  average: number;
}

export enum DrowsinessLevel {
  NO_FACE = 'NO_FACE',
  AWAKE = 'AWAKE',
  WARNING = 'WARNING', // eyes closing but not yet past the alert duration
  DROWSY = 'DROWSY', // eyes closed past the alert duration -> beep
}

export interface DrowsinessSnapshot {
  level: DrowsinessLevel;
  ear: number;
  eyesClosedForMs: number;
  faceScore: number;
  timestamp: number;
}

/** Region of interest used to crop the next frame (tracking). */
export interface Roi {
  x: number;
  y: number;
  size: number;
}