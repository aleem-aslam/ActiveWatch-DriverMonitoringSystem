// Tiny global store so any screen can call showAlert({...}) and the
// themed dialog (ThemedAlertHost) shows it. Replaces the grey system Alert.alert.
import { useSyncExternalStore } from 'react';

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertOptions = {
  type?: 'error' | 'success' | 'info' | 'warning';
  title: string;
  message?: string;
  buttons?: AlertButton[]; // default: a single "OK"
};

export type ActiveAlert = AlertOptions & { id: number };

let current: ActiveAlert | null = null;
let counter = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showAlert(options: AlertOptions) {
  current = { ...options, id: ++counter };
  emit();
}

/**
 * Drop-in for React Native's Alert.alert(title, message?, buttons?).
 * Picks the icon/colour from the title and the buttons, so existing calls only need the import changed.
 */
export function themedAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const t = title.toLowerCase();
  let type: AlertOptions['type'] = 'info';
  if (buttons?.some((b) => b.style === 'destructive')) type = 'warning';
  else if (/fail|error|denied|invalid|unable|could not|couldn't|wrong|incorrect|cannot|can't/.test(t)) type = 'error';
  else if (/success|saved|done|created|sent|deleted|updated|complete|welcome/.test(t)) type = 'success';
  else if (/missing|weak|required|warning|confirm|match|reset|clear|permission|sure/.test(t)) type = 'warning';
  showAlert({ type, title, message, buttons });
}

// ---- only ONE ThemedAlertHost renders, even if several are mounted ----
const hosts: symbol[] = [];
const hostListeners = new Set<() => void>();
const emitHosts = () => hostListeners.forEach((l) => l());

export function registerHost(id: symbol) {
  hosts.push(id);
  emitHosts();
  return () => {
    const i = hosts.indexOf(id);
    if (i >= 0) hosts.splice(i, 1);
    emitHosts();
  };
}

export function useIsPrimaryHost(id: symbol): boolean {
  return useSyncExternalStore(
    (l) => {
      hostListeners.add(l);
      return () => {
        hostListeners.delete(l);
      };
    },
    () => hosts[0] === id
  );
}

export function hideAlert() {
  if (!current) return;
  current = null;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useActiveAlert(): ActiveAlert | null {
  return useSyncExternalStore(subscribe, () => current);
}