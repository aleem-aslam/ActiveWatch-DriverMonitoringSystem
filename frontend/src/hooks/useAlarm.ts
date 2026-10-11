// src/hooks/useAlarm.ts
// Beep + vibrate while `active` is true: fires at once, then repeats. Duration, sound
// and vibration come from Settings. Stops the instant `active` turns false.
import { useEffect } from 'react';
import { Vibration } from 'react-native';
import { loadAlertSound, playAlertBeep, stopAlertBeep, unloadAlertSound } from '../services/beepAlert';

const GAP_MS = 800;

export function useAlarm(
  active: boolean,
  s: { alertSound: boolean; vibration: boolean; alertDurationSeconds: number }
) {
  useEffect(() => {
    loadAlertSound();
    return () => unloadAlertSound();
  }, []);

  useEffect(() => {
    if (!active) return;
    const ms = Math.round(s.alertDurationSeconds * 1000);
    const fire = () => {
      if (s.alertSound) playAlertBeep(ms);
      if (s.vibration) Vibration.vibrate(ms);
    };
    fire();
    const id = setInterval(fire, ms + GAP_MS);
    return () => {
      clearInterval(id);
      Vibration.cancel();
      stopAlertBeep();
    };
  }, [active, s.alertSound, s.vibration, s.alertDurationSeconds]);
}