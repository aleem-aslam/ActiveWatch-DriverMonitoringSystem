// src/firebase/fleetService.ts
// Sends each safety event to Firestore (already in the app, works on the free Spark plan),
// where the fleet dashboard can read it live with onSnapshot().
//
//   fleetEvents/{autoId}     every event            (newest = highest createdAt)
//   fleetDrivers/{uid}       latest event of each driver (for a live "who is where" table)
//
// Suggested Firestore rules (add to your existing ones):
//   match /fleetEvents/{id}  { allow create: if request.auth != null && request.resource.data.uid == request.auth.uid; }
//   match /fleetDrivers/{uid} { allow write: if request.auth != null && request.auth.uid == uid; }
// Reading is left closed here; the dashboard should use an admin account/rule of your choosing.
import { Platform } from 'react-native';
import { addDoc, collection, doc, getFirestore, serverTimestamp, setDoc } from '@react-native-firebase/firestore';

export type FleetEventType = 'DROWSY' | 'NO_FACE' | 'APPROACHING' | 'CROSSING' | 'HARD_BRAKING' | 'TAILGATING';

export type FleetEvent = {
  type: FleetEventType;
  occurredAtIso: string;
  ttcSeconds?: number | null;
  distanceMeters?: number | null;
  leadSpeedKmh?: number | null;
  ownSpeedKmh?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  detail?: string | null;
};

// Firestore rejects `undefined`; turn it into null.
function clean<T extends Record<string, any>>(o: T): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(o)) out[k] = o[k] === undefined ? null : o[k];
  return out;
}

export async function pushFleetEvent(uid: string, ev: FleetEvent): Promise<boolean> {
  try {
    const db = getFirestore();
    const payload = clean({ ...ev, uid, platform: Platform.OS });
    await addDoc(collection(db, 'fleetEvents'), { ...payload, createdAt: serverTimestamp() });
    await setDoc(doc(db, 'fleetDrivers', uid), { lastEvent: payload, updatedAt: serverTimestamp() }, { merge: true });
    console.log('[fleet] event sent:', ev.type);
    return true;
  } catch (e) {
    console.warn('[fleet] could not send event:', e);
    return false;
  }
}