// services/beepAlert.ts
import Sound from 'react-native-sound';

Sound.setCategory('Playback');

// Android: the file must be at android/app/src/main/res/raw/alert_beep.mp3
// (lowercase, no spaces). iOS: add it to the Xcode project bundle.
const SOUND_FILE = 'alert_beep.mp3';

let alertSound: Sound | null = null;
let isLoading = false;
let lastPlayedAt = 0;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
const MIN_REPLAY_INTERVAL_MS = 500;

function clearStopTimer() {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
}

export function loadAlertSound(): void {
  if (alertSound || isLoading) return;
  isLoading = true;
  const sound = new Sound(SOUND_FILE, Sound.MAIN_BUNDLE, (error) => {
    isLoading = false;
    if (error) {
      console.warn(
        `[beep] FAILED to load "${SOUND_FILE}". On Android check android/app/src/main/res/raw/ and rebuild.`,
        error
      );
      alertSound = null;
      return;
    }
    sound.setVolume(1.0);
    alertSound = sound;
    console.log(`[beep] loaded "${SOUND_FILE}", duration ${sound.getDuration().toFixed(2)}s`);
  });
}

/**
 * Plays the beep. If maxDurationMs is given, playback is cut off after that
 * long (this is the "Alert Duration" setting), even if the file is longer.
 */
export function playAlertBeep(maxDurationMs?: number): void {
  if (!alertSound) {
    console.warn('[beep] sound not ready, retrying load');
    loadAlertSound();
    return;
  }
  const now = Date.now();
  if (now - lastPlayedAt < MIN_REPLAY_INTERVAL_MS) return;
  lastPlayedAt = now;

  const sound = alertSound;
  clearStopTimer();
  sound.stop(() => {
    sound.play((success) => {
      if (!success) {
        console.warn('[beep] playback failed, reloading sound');
        sound.release();
        if (alertSound === sound) alertSound = null;
        loadAlertSound();
      }
    });
    if (maxDurationMs && maxDurationMs > 0) {
      stopTimer = setTimeout(() => sound.stop(), maxDurationMs);
    }
  });
}

// Cut off a beep that is mid-playback (called the moment the alert ends).
export function stopAlertBeep(): void {
  clearStopTimer();
  alertSound?.stop();
  lastPlayedAt = 0; // so the next alert beeps immediately
}

export function unloadAlertSound(): void {
  clearStopTimer();
  alertSound?.release();
  alertSound = null;
  isLoading = false;
}