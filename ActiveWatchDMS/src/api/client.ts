// src/api/client.ts
import axios from 'axios';

// Changed to localhost to force routing through the physical USB cable via ADB reverse
const BASE_URL = 'http://127.0.0.1:8000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Health check service
export async function checkBackendHealth() {
  try {
    const response = await apiClient.get('/');
    console.log('Backend connected:', response.data);
    return response.data;
  } catch (error) {
    console.error('Backend connection failed:', error);
    return null;
  }
}

// Telemetry event dispatcher (called when drowsiness or collision warning triggers)
export async function sendTelemetryEvent(eventType: string, confidence: number) {
  try {
    const response = await apiClient.post('/api/telemetry', {
      event_type: eventType,
      timestamp: new Date().toISOString(),
      confidence: confidence,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to send telemetry:', error);
  }
}