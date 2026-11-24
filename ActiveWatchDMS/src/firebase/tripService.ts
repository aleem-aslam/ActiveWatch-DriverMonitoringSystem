// src/firebase/tripService.ts
// users/{uid}/trips/{autoId}: one small document per finished trip.
import { addDoc, collection, deleteDoc, doc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, serverTimestamp } from '@react-native-firebase/firestore';
import type { TripSummary } from '../services/tripStore';

export async function saveTrip(uid: string, trip: TripSummary) {
  return addDoc(collection(getFirestore(), 'users', uid, 'trips'), { ...trip, createdAt: serverTimestamp() });
}

export async function listTrips(uid: string, max = 20): Promise<(TripSummary & { id: string })[]> {
  const q = query(collection(getFirestore(), 'users', uid, 'trips'), orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as TripSummary) }));
}

/** Live list of the last trips, newest first. Returns the unsubscribe function. */
export function subscribeToTrips(uid: string, onData: (trips: (TripSummary & { id: string })[]) => void, onError?: (e: any) => void) {
  const q = query(collection(getFirestore(), 'users', uid, 'trips'), orderBy('createdAt', 'desc'), limit(30));
  return onSnapshot(
    q,
    (snap: any) => onData(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as TripSummary) }))),
    (e: any) => onError?.(e)
  );
}

export async function deleteTrip(uid: string, id: string) {
  await deleteDoc(doc(getFirestore(), 'users', uid, 'trips', id));
}