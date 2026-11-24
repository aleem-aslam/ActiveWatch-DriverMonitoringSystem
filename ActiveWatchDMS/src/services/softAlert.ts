import Sound from 'react-native-sound';

Sound.setCategory('Playback');

// android/app/src/main/res/raw/alert_soft.mp3  (lowercase, no spaces)
const SOUND_FILE = 'alert_soft.mp3';
let sound: Sound | null = null;
let loading = false;

export function loadSoftSound(): void {
  if (sound || loading) return;
  loading = true;
  const s = new Sound(SOUND_FILE, Sound.MAIN_BUNDLE, (error) => {
    loading = false;
    if (error) {
      console.warn('[soft] failed to load alert_soft.mp3', error);
      return;
    }
    s.setVolume(0.6);
    sound = s;
  });
}

export function playSoftChime(): void {
  if (!sound) {
    loadSoftSound();
    return;
  }
  const s = sound;
  s.stop(() => s.play());
}

export function stopSoftChime(): void {
  sound?.stop();
}

export function unloadSoftSound(): void {
  sound?.release();
  sound = null;
  loading = false;
}
