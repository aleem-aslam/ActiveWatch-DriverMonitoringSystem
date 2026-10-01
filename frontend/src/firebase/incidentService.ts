import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from '@react-native-firebase/firestore';

const db = getFirestore();

export interface DrowsinessIncident {
  id: string;
  ear: number;
  faceScore: number;
  eyesClosedForMs: number;
  timestamp: any; // Firestore Timestamp
}

/**
 * NOT CALLED ANYWHERE YET. This is the write side History needs data from.
 * It should be called from CameraScreen.tsx's runOneCycle(), at the same
 * point the DROWSY beep fires, debounced the same way (one incident per
 * sustained episode, not one per ~125ms cycle). I don't have that file's
 * current content — paste it and I'll wire this in properly.
 */
export async function logDrowsinessIncident(
  uid: string,
  data: { ear: number; faceScore: number; eyesClosedForMs: number }
) {
  const incidentsRef = collection(db, "users", uid, "incidents");
  return addDoc(incidentsRef, { ...data, timestamp: serverTimestamp() });
}

/** Real-time subscription to a user's recent incidents, newest first. */
export function subscribeToIncidents(
  uid: string,
  onChange: (incidents: DrowsinessIncident[]) => void,
  max = 50
) {
  const incidentsRef = collection(db, "users", uid, "incidents");
  const q = query(incidentsRef, orderBy("timestamp", "desc"), limit(max));

  return onSnapshot(
    q,
    (snapshot) => {
      onChange(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    },
    (error) => console.warn("Failed to subscribe to incidents:", error)
  );
}