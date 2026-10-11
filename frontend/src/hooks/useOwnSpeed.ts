// src/hooks/useOwnSpeed.ts
// Your own speed (and position) from GPS. Needed to turn "the car ahead is closing at
// X m/s" into "the car ahead is doing Y km/h". Without it the road monitor still works,
// but speeds are relative to you and no km/h is shown.
//
// Needs:  npm i @react-native-community/geolocation
//         <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />  in AndroidManifest.xml
import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

let Geolocation: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('@react-native-community/geolocation');
  Geolocation = m.default ?? m;
} catch {
  Geolocation = null; // package not installed: speed-from-GPS is simply unavailable
}

const STALE_MS = 3000;
const DECEL_WINDOW_MS = 2000;

export type GpsFix = { speedMps: number | null; lat: number; lng: number; at: number };
export type GpsStatus = 'starting' | 'ok' | 'no-package' | 'no-permission' | 'error';

export function useOwnSpeed() {
  const fixRef = useRef<GpsFix | null>(null);
  const histRef = useRef<{ t: number; v: number }[]>([]);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [status, setStatus] = useState<GpsStatus>('starting');

  useEffect(() => {
    if (!Geolocation) {
      setStatus('no-package');
      return;
    }
    let watchId: number | null = null;
    let cancelled = false;

    (async () => {
      if (Platform.OS === 'android') {
        const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (r !== PermissionsAndroid.RESULTS.GRANTED) {
          setStatus('no-permission');
          return;
        }
      }
      if (cancelled) return;
      try {
        Geolocation.setRNConfiguration?.({ skipPermissionRequests: true, authorizationLevel: 'whenInUse', locationProvider: 'auto' });
      } catch {}
      watchId = Geolocation.watchPosition(
        (pos: any) => {
          const s = pos?.coords?.speed;
          const v = typeof s === 'number' && s >= 0 ? s : null;
          if (v !== null) {
            const now = Date.now();
            histRef.current.push({ t: now, v });
            while (histRef.current.length > 0 && now - histRef.current[0].t > DECEL_WINDOW_MS + 1000) histRef.current.shift();
          }
          fixRef.current = {
            speedMps: v,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            at: Date.now(),
          };
          setStatus('ok');
        },
        (err: any) => {
          console.warn('[gps]', err?.message ?? err);
          setStatus('error');
        },
        { enableHighAccuracy: true, distanceFilter: 0, interval: 1000, fastestInterval: 500 }
      );
      if (cancelled && watchId !== null) Geolocation.clearWatch(watchId);
    })();

    const ui = setInterval(() => {
      const f = fixRef.current;
      setSpeedKmh(f && f.speedMps !== null && Date.now() - f.at < STALE_MS ? f.speedMps * 3.6 : null);
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(ui);
      if (watchId !== null && Geolocation) Geolocation.clearWatch(watchId);
    };
  }, []);

  const getSpeedMps = useCallback((): number | null => {
    const f = fixRef.current;
    if (!f || f.speedMps === null || Date.now() - f.at > STALE_MS) return null;
    return f.speedMps;
  }, []);
  /** How hard YOU are braking in m/s^2 (positive = slowing down), from GPS speed over ~2 s. null = unknown. */
  const getOwnDecelMps2 = useCallback((): number | null => {
    const h = histRef.current;
    const now = Date.now();
    const recent = h.filter((p) => now - p.t <= DECEL_WINDOW_MS);
    if (recent.length < 2) return null;
    const a = recent[0];
    const b = recent[recent.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt < 0.8) return null;
    return (a.v - b.v) / dt;
  }, []);
  const getFix = useCallback((): GpsFix | null => fixRef.current, []);

  return { getSpeedMps, getOwnDecelMps2, getFix, speedKmh, status };
}