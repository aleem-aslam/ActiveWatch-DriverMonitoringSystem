// src/firebase/historyService.ts
// Live feed for the History screen: drowsiness events (users/{uid}/drowsyEvents) and road
// warnings (users/{uid}/roadIncidents) merged into one list, newest first.
import { collection, deleteDoc, doc, getFirestore, limit, onSnapshot, orderBy, query } from '@react-native-firebase/firestore';

export type HistoryKind = 'DROWSY' | 'APPROACHING' | 'CROSSING' | 'HARD_BRAKING' | 'TAILGATING';

export type HistoryEvent = {
  id: string;
  kind: HistoryKind;
  at: Date;
  imageBase64: string | null;
  eyesClosedMs: number | null;
  ttcSeconds: number | null;
  distanceMeters: number | null;
  leadSpeedKmh: number | null;
  ownSpeedKmh: number | null;
  latitude: number | null;
  longitude: number | null;
};

const MAX_PER_KIND = 30;

function toDate(ts: any, fallbackIso?: string): Date {
  if (ts && typeof ts.toDate === 'function') return ts.toDate();
  if (fallbackIso) return new Date(fallbackIso);
  return new Date(); // a just-written document whose server time has not arrived yet
}

export function subscribeToHistory(
  uid: string,
  onData: (events: HistoryEvent[]) => void,
  onError?: (e: any) => void
): () => void {
  const db = getFirestore();
  let drowsy: HistoryEvent[] = [];
  let road: HistoryEvent[] = [];
  const emit = () => onData([...drowsy, ...road].sort((a, b) => b.at.getTime() - a.at.getTime()));

  const unsubA = onSnapshot(
    query(collection(db, 'users', uid, 'drowsyEvents'), orderBy('createdAt', 'desc'), limit(MAX_PER_KIND)),
    (snap: any) => {
      drowsy = snap.docs.map((d: any) => {
        const x = d.data();
        return {
          id: 'd_' + d.id, kind: 'DROWSY' as const, at: toDate(x.createdAt),
          imageBase64: x.imageBase64 ?? null, eyesClosedMs: x.eyesClosedForMs ?? null,
          ttcSeconds: null, distanceMeters: null, leadSpeedKmh: null, ownSpeedKmh: null, latitude: null, longitude: null,
        };
      });
      emit();
    },
    (e: any) => onError?.(e)
  );

  const unsubB = onSnapshot(
    query(collection(db, 'users', uid, 'roadIncidents'), orderBy('createdAt', 'desc'), limit(MAX_PER_KIND)),
    (snap: any) => {
      road = snap.docs.map((d: any) => {
        const x = d.data();
        return {
          id: 'r_' + d.id, kind: (x.type ?? 'APPROACHING') as HistoryKind, at: toDate(x.createdAt, x.occurredAtIso),
          imageBase64: x.imageBase64 ?? null, eyesClosedMs: null,
          ttcSeconds: x.ttcSeconds ?? null, distanceMeters: x.distanceMeters ?? null,
          leadSpeedKmh: x.leadSpeedKmh ?? null, ownSpeedKmh: x.ownSpeedKmh ?? null,
          latitude: x.latitude ?? null, longitude: x.longitude ?? null,
        };
      });
      emit();
    },
    (e: any) => onError?.(e)
  );

  return () => {
    unsubA();
    unsubB();
  };
}

/** Deletes one event. Ids are prefixed: d_ = drowsyEvents, r_ = roadIncidents. */
export async function deleteHistoryEvent(uid: string, ev: { id: string }) {
  const col = ev.id.startsWith('d_') ? 'drowsyEvents' : 'roadIncidents';
  await deleteDoc(doc(getFirestore(), 'users', uid, col, ev.id.slice(2)));
}