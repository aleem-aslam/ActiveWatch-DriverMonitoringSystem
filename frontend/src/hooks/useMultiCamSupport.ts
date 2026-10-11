// src/hooks/useMultiCamSupport.ts
// Answers one question once per app run: can THIS phone stream the front and rear
// camera at the same time? Many Android phones cannot, so the Settings screen uses
// this to disable the "Both" option instead of letting it fail.
import { useEffect, useState } from 'react';
import * as VC from 'react-native-vision-camera';

let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;

export function checkMultiCamSupport(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    try {
      const vc: any = (VC as any).VisionCamera;
      if (!vc?.supportsMultiCamSessions) return false;
      const factory = await vc.createDeviceFactory();
      const combos: any[][] = factory.supportedMultiCamDeviceCombinations ?? [];
      return combos.some(
        (c) => c.some((d: any) => d.position === 'front') && c.some((d: any) => d.position === 'back')
      );
    } catch (e) {
      console.warn('[multicam] support check failed:', e);
      return false;
    }
  })().then((ok) => {
    cached = ok;
    console.log('[multicam] front+rear at once supported:', ok);
    return ok;
  });
  return pending;
}

export function useMultiCamSupport() {
  const [state, setState] = useState({ checked: cached !== null, supported: cached === true });
  useEffect(() => {
    if (cached !== null) return;
    let alive = true;
    checkMultiCamSupport().then((ok) => alive && setState({ checked: true, supported: ok }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}