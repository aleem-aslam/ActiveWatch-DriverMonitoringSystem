// src/screens/setup/firstRunStore.ts
// Tiny store: is the setup guide open, and has the person already seen it.
// "Seen" is remembered in a small file (react-native-fs); if that fails the guide just shows again.
import { useSyncExternalStore } from 'react';
import RNFS from 'react-native-fs';

const FILE = `${RNFS.DocumentDirectoryPath}/setup_guide_seen.txt`;
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openSetupGuide() { open = true; emit(); }
export function closeSetupGuide() { open = false; emit(); }

export async function showGuideIfFirstRun() {
  try {
    if (await RNFS.exists(FILE)) return;
  } catch {}
  openSetupGuide();
}
export async function markGuideSeen() {
  try { await RNFS.writeFile(FILE, '1', 'utf8'); } catch {}
}

export function useSetupGuideOpen() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => open,
    () => open
  );
}