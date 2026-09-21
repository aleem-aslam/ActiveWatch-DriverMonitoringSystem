import axios from 'axios';

// Your filled Firebase credentials
const FIREBASE_API_KEY = 'AIzaSyBEfGNXeDFnEzM_sI0X-pgXkFQ2z6OjHWA';
const PROJECT_ID = 'activewatch-dms-8794e';

// REST API Base URL for your Firestore instance
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export const firestoreClient = axios.create({
  baseURL: FIRESTORE_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  params: {
    key: FIREBASE_API_KEY,
  },
});

/**
 * Sends a test document to the 'users' collection in Firestore.
 */
export async function testFirestoreConnection() {
  try {
    const response = await firestoreClient.post('/users', {
      fields: {
        fullName: { stringValue: 'Test Driver' },
        email: { stringValue: 'driver@test.com' },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    });
    console.log('Successfully written to Firestore:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Firestore connection error:', error?.response?.data || error.message);
    throw error;
  }
}