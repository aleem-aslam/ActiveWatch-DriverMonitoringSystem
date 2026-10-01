import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from '@react-native-firebase/firestore';

const db = getFirestore();

// Matches the schema written by scripts/firebaseMigration.js, plus three
// settings fields (alertDurationSeconds, noFaceAlert, saveDrowsyImages)
// the migration didn't include, added for the new Settings screen.
export async function createUserDocument(user: any) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email ?? "",
      fullName: user.displayName ?? "",
      phone: "",
      photoURL: user.photoURL ?? "",
      provider: user.providerData?.[0]?.providerId ?? "password",
      accountStatus: "active",
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),

      driverProfile: {
        age: "",
        gender: "",
        experienceYears: 0,
        licenseNumber: "",
        licenseExpiry: "",
      },

      vehicle: {
        brand: "",
        model: "",
        year: "",
        registrationNumber: "",
      },

      settings: {
        theme: "system",
        language: "en",
        alertSound: true,
        vibration: true,
        drowsinessSensitivity: 80,
        alertDurationSeconds: 0.5,
        noFaceAlert: false,
        saveDrowsyImages: false,
        accidentDetection: true,
      },

      statistics: {
        totalTrips: 0,
        totalDistance: 0,
        dangerEvents: 0,
        accidents: 0,
      },
    });
  }
}

export async function getUserDocument(uid: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  return null;
}

export async function updateUserDocument(uid: string, data: any) {
  const ref = doc(db, "users", uid);
  return updateDoc(ref, data);
}

// Dedicated Settings-screen writer: patches only the given keys under
// settings.* via dot-notation, so a partial update (e.g. just
// { vibration: false }) can't wipe the rest of the settings map the way
// a plain updateDoc({ settings: {...} }) would.
export async function updateUserSettings(uid: string, patch: Record<string, any>) {
  const ref = doc(db, "users", uid);
  const dotted: Record<string, any> = {};
  for (const [key, value] of Object.entries(patch)) {
    dotted[`settings.${key}`] = value;
  }
  return updateDoc(ref, dotted);
}