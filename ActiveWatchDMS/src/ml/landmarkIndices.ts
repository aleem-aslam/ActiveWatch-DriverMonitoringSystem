/**
 * MediaPipe FaceMesh (468-point) indices for the 6-point EAR formula,
 * ordered [outerCorner, topOuter, topInner, innerCorner, bottomInner, bottomOuter].
 * These are the subject's own anatomical eyes (not mirrored) — "right eye"
 * appears on the LEFT side of a front-camera selfie preview.
 */
export const RIGHT_EYE_EAR_INDICES = [33, 160, 158, 133, 153, 144] as const;
export const LEFT_EYE_EAR_INDICES = [362, 385, 387, 263, 373, 380] as const;