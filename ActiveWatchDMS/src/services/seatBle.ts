// src/services/seatBle.ts
// Bluetooth link to the ESP32 haptic seat. When the driver is drowsy the phone writes the
// text "WAKE" to the seat; the ESP32 then vibrates the seat.
//
// Needs:  npm i react-native-ble-plx   (+ Android Bluetooth permissions in AndroidManifest.xml)
// The three constants below MUST match the ESP32 firmware. The UUIDs are the common
// "Nordic UART" ones used in many ESP32 examples; change them to yours.
import { PermissionsAndroid, Platform } from 'react-native';

const SEAT_NAME_PREFIX = 'ActiveWatch'; // the ESP32's advertised name starts with this
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const WRITE_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const WAKE_BASE64 = 'V0FLRQ=='; // base64 of "WAKE"
const SCAN_TIMEOUT_MS = 10000;
const MIN_SEND_INTERVAL_MS = 2500;

let Ble: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Ble = require('react-native-ble-plx');
} catch {
  Ble = null;
}

let manager: any = null;
let device: any = null;
let connecting: Promise<boolean> | null = null;
let lastSentAt = 0;

async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  const wanted =
    api >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const res = await PermissionsAndroid.requestMultiple(wanted as any);
  return wanted.every((p) => (res as any)[p] === PermissionsAndroid.RESULTS.GRANTED);
}

export function seatBleAvailable(): boolean {
  return Ble !== null;
}

export function isSeatConnected(): boolean {
  return device !== null;
}

/** Scans for the seat and connects. Resolves true when connected. Safe to call repeatedly. */
export function connectSeat(): Promise<boolean> {
  if (!Ble) return Promise.resolve(false);
  if (device) return Promise.resolve(true);
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      if (!(await ensurePermissions())) {
        console.warn('[seat] Bluetooth permission not granted');
        return false;
      }
      if (!manager) manager = new Ble.BleManager();

      const found: any = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          manager.stopDeviceScan();
          resolve(null);
        }, SCAN_TIMEOUT_MS);
        manager.startDeviceScan(null, null, (error: any, d: any) => {
          if (error) {
            clearTimeout(timer);
            console.warn('[seat] scan error:', error?.message ?? error);
            resolve(null);
            return;
          }
          const name: string = d?.name ?? d?.localName ?? '';
          if (name.startsWith(SEAT_NAME_PREFIX)) {
            clearTimeout(timer);
            manager.stopDeviceScan();
            resolve(d);
          }
        });
      });
      if (!found) {
        console.warn('[seat] seat not found (is the ESP32 on and named "' + SEAT_NAME_PREFIX + '..."?)');
        return false;
      }
      const connected = await found.connect();
      await connected.discoverAllServicesAndCharacteristics();
      connected.onDisconnected(() => {
        device = null;
        console.log('[seat] disconnected');
      });
      device = connected;
      console.log('[seat] connected to', found.name);
      return true;
    } catch (e) {
      console.warn('[seat] connect failed:', e);
      device = null;
      return false;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

/** Sends "WAKE" to the seat (at most once every 2.5 s). Returns true if it was written. */
export async function sendWake(): Promise<boolean> {
  if (!Ble) return false;
  const now = Date.now();
  if (now - lastSentAt < MIN_SEND_INTERVAL_MS) return false;
  if (!device) {
    connectSeat(); // try in the background; the next call will have it
    return false;
  }
  try {
    lastSentAt = now;
    await device.writeCharacteristicWithResponseForService(SERVICE_UUID, WRITE_CHAR_UUID, WAKE_BASE64);
    console.log('[seat] WAKE sent');
    return true;
  } catch (e) {
    console.warn('[seat] write failed:', e);
    device = null;
    return false;
  }
}

export async function disconnectSeat() {
  try {
    if (device) await device.cancelConnection();
  } catch {}
  device = null;
}