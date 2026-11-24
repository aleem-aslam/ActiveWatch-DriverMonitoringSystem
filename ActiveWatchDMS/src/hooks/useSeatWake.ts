// src/hooks/useSeatWake.ts
// Connects to the ESP32 seat while the camera screen is open and sends "WAKE" every few
// seconds for as long as `drowsy` is true.
import { useEffect } from 'react';
import { connectSeat, disconnectSeat, sendWake } from '../services/seatBle';

const REPEAT_MS = 3000;

export function useSeatWake(drowsy: boolean) {
  useEffect(() => {
    connectSeat();
    return () => {
      disconnectSeat();
    };
  }, []);

  useEffect(() => {
    if (!drowsy) return;
    sendWake();
    const id = setInterval(sendWake, REPEAT_MS);
    return () => clearInterval(id);
  }, [drowsy]);
}