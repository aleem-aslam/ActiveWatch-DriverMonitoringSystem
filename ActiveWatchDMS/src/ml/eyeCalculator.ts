import type { Point3D } from '../../types';
import { LEFT_EYE_EAR_INDICES, RIGHT_EYE_EAR_INDICES } from './landmarkIndices';

export interface EyePoints {
  outerCorner: Point3D;
  topOuter: Point3D;
  topInner: Point3D;
  innerCorner: Point3D;
  bottomInner: Point3D;
  bottomOuter: Point3D;
}

function pick(landmarks: Point3D[], indices: readonly number[]): EyePoints {
  const [outerCorner, topOuter, topInner, innerCorner, bottomInner, bottomOuter] =
    indices.map((i) => landmarks[i]);
  return { outerCorner, topOuter, topInner, innerCorner, bottomInner, bottomOuter };
}

export function getLeftEyePoints(landmarks: Point3D[]): EyePoints {
  return pick(landmarks, LEFT_EYE_EAR_INDICES);
}

export function getRightEyePoints(landmarks: Point3D[]): EyePoints {
  return pick(landmarks, RIGHT_EYE_EAR_INDICES);
}
