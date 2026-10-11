// src/hooks/useSettings.ts
//
// One shared settings store used by BOTH SettingsScreen and CameraScreen, so a
// change in Settings takes effect on the camera instantly.
//  - Guest (not signed in): changes apply immediately and live for this session only.
//  - Signed in: changes apply immediately AND are saved to Firebase; the saved
//    settings are loaded back automatically when the account's profile loads.
import { useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { AuthContext } from '../context/AuthContext';
import { updateUserSettings } from '../firebase/userService';

// What the camera screen runs: front camera only, rear camera only, or both together
// (the last only on phones that can stream both cameras at once).
export type MonitoringMode = 'driver' | 'road' | 'both';
// Night / low-visibility handling on the road camera: detect it by itself, always on, or never.
export type NightMode = 'auto' | 'on' | 'off';

export const DEFAULT_SETTINGS = {
  monitoringMode: 'driver' as MonitoringMode,
  collisionTtcSeconds: 2.5, // road camera: time-to-collision below this -> collision alert
  followingWarning: true, // road camera: warn when you follow the car ahead too closely
  followingGapSeconds: 1.5, // ... closer than this many seconds of travel
  laneDepartureWarning: true, // road camera: warn when you drift out of your lane
  nightMode: 'auto' as NightMode, // road camera: brighten + lower the detection threshold in the dark / haze
  distanceScale: 1, // road camera: distance calibration factor (1 = not calibrated)
  alertSound: true,
  vibration: true,
  drowsinessSensitivity: 80, // 0-100, higher = flags drowsiness more easily
  drowsinessTimeSeconds: 1.5, // eyes closed this long -> DROWSY
  alertDurationSeconds: 0.5, // how long each beep / vibration lasts
  noFaceAlert: false, // alert when no face is seen for a few seconds
  saveDrowsyImages: false, // save a snapshot to Firebase on each drowsy event (signed-in only)
  accidentDetection: true, // rear-camera collision warning (feature in progress)
};

export type AppSettings = typeof DEFAULT_SETTINGS;

// ---- tiny external store (no provider needed) --------------------------------
let current: AppSettings = { ...DEFAULT_SETTINGS };
let boundUid: string | null = null;
const listeners = new Set<() => void>();

function sameSettings(a: AppSettings, b: AppSettings): boolean {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]).every((k) => a[k] === b[k]);
}

function setStore(next: AppSettings) {
  if (sameSettings(current, next)) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Take only known keys with the right type from a remote (Firebase) object.
function mergeKnown(base: AppSettings, remote?: Record<string, unknown> | null): AppSettings {
  const out: any = { ...base };
  if (!remote) return out;
  (Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]).forEach((k) => {
    const v = remote[k];
    if (v !== undefined && typeof v === typeof DEFAULT_SETTINGS[k]) out[k] = v;
  });
  return out;
}

export function useSettings() {
  const { user, profile } = useContext(AuthContext) as any;
  const uid: string | null = user?.uid ?? null;
  const remote = profile?.settings as Record<string, unknown> | undefined;
  const remoteKey = JSON.stringify(remote ?? null);

  const settings = useSyncExternalStore(subscribe, () => current);
  const [saving, setSaving] = useState(false);

  // Keep the store in sync with the signed-in account.
  useEffect(() => {
    if (uid !== boundUid) {
      // Signed in / out / switched account: start from defaults (+ that account's saved settings).
      boundUid = uid;
      setStore(mergeKnown(DEFAULT_SETTINGS, uid ? remote : undefined));
    } else if (uid && remote) {
      setStore(mergeKnown(current, remote));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, remoteKey]);

  // Apply right now, and save to Firebase if signed in.
  const update = useCallback(
    async (patch: Partial<AppSettings>) => {
      setStore({ ...current, ...patch });
      if (!uid) return; // guest: session-only
      setSaving(true);
      try {
        await updateUserSettings(uid, patch as any);
      } catch (error) {
        console.warn('Failed to save settings:', error);
      } finally {
        setSaving(false);
      }
    },
    [uid]
  );

  // Apply right now WITHOUT saving (used while a slider is being dragged).
  const preview = useCallback((patch: Partial<AppSettings>) => {
    setStore({ ...current, ...patch });
  }, []);

  const reset = useCallback(() => update({ ...DEFAULT_SETTINGS }), [update]);

  return { settings, update, preview, reset, saving, uid, loggedIn: uid !== null };
}