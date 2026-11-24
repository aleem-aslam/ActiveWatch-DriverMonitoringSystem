// src/firebase/roadIncidentService.ts
// One document per road incident under the signed-in user:
//   users/{uid}/roadIncidents/{autoId}
// The photo is a small JPEG stored as base64 text (about 40-80 KB, far below Firestore's
// 1 MB document limit) with the date/time burned into the picture AND stored as fields.
// No Firebase Storage needed. (Video would need Storage; see the notes in the chat.)
import { addDoc, collection, getFirestore, serverTimestamp } from '@react-native-firebase/firestore';

export type RoadIncidentInput = {
  type: 'APPROACHING' | 'CROSSING' | 'HARD_BRAKING' | 'TAILGATING';
  occurredAtIso: string; // UTC, e.g. 2026-10-11T09:12:03.456Z
  occurredAtLocal: string; // device local time, e.g. 2026-10-11 14:12:03
  imageBase64: string;
  imageWidth: number;
  imageHeight: number;
  ttcSeconds: number | null;
  distanceMeters: number | null;
  leadSpeedKmh: number | null;
  ownSpeedKmh: number | null;
  latitude: number | null;
  longitude: number | null;
};

export async function saveRoadIncident(uid: string, event: RoadIncidentInput) {
  return addDoc(collection(getFirestore(), 'users', uid, 'roadIncidents'), {
    ...event,
    imageMime: 'image/jpeg',
    createdAt: serverTimestamp(),
  });
}