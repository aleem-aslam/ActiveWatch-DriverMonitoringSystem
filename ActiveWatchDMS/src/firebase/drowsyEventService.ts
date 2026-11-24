// src/firebase/drowsyEventService.ts
// Saves one document per drowsy event under the signed-in user:
//   users/{uid}/drowsyEvents/{autoId}
// The snapshot is a small (192x192) JPEG stored as base64 text, which keeps it
// far below Firestore's 1 MB document limit (typically ~10-20 KB). This avoids
// needing Firebase Storage; if you add Storage later, store the file there and
// keep only its URL in this document.
import { addDoc, collection, getFirestore, serverTimestamp } from '@react-native-firebase/firestore';

export type DrowsyEventInput = {
  imageBase64: string;
  ear: number;
  eyesClosedForMs: number;
  drowsyTimeSeconds: number;
};

export async function saveDrowsyEvent(uid: string, event: DrowsyEventInput) {
  return addDoc(collection(getFirestore(), 'users', uid, 'drowsyEvents'), {
    ...event,
    imageMime: 'image/jpeg',
    imageSizePx: 192,
    createdAt: serverTimestamp(),
  });
}