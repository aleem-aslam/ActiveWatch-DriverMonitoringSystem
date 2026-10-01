// services/beepAlert.ts
import Sound from 'react-native-sound';

Sound.setCategory('Playback');

let alertSound: Sound | null = null;
let lastPlayedAt = 0;
const MIN_REPLAY_INTERVAL_MS = 2000; // don't spam the beep every cycle while DROWSY holds

export function loadAlertSound(): void {
  if (alertSound) return;
  alertSound = new Sound('alert_beep.mp3', Sound.MAIN_BUNDLE, (error) => {
    if (error) {
      console.warn('Failed to load alert sound:', error);
      alertSound = null;
    }
  });
}

export function playAlertBeep(): void {
  if (!alertSound) return;
  const now = Date.now();
  if (now - lastPlayedAt < MIN_REPLAY_INTERVAL_MS) return;
  lastPlayedAt = now;
  alertSound.stop(() => alertSound?.play());
}

export function unloadAlertSound(): void {
  alertSound?.release();
  alertSound = null;
}