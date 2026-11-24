// src/firebase/google.ts
// Google Sign-In -> Firebase Auth.
//
// Paste your Web client ID below (the "client_type": 3 entry in android/app/google-services.json).
// It is not a secret. Do not rely on 'autoDetect' for release builds: Android's resource
// shrinker can remove the value it reads, which makes every Google sign-in fail in the APK.
//
// Messages thrown from here are written for END USERS. Technical details go to the log only
// (adb logcat -s ReactNativeJS).
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { getAuth, GoogleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { getAuthErrorMessage } from '../utils/firebaseErrors';

const WEB_CLIENT_ID = '685443010530-9brso6r3p4cjedf3arctk14gess23erm.apps.googleusercontent.com'; 

const GENERIC = 'Google sign-in is not available right now. Please try again later or sign in with your email.';

function fail(code: string, message: string): never {
  const err: any = new Error(message);
  err.code = code;
  throw err;
}

let configured = false;
function configure() {
  if (configured) return;
  if (!WEB_CLIENT_ID) console.warn('[google] WEB_CLIENT_ID is empty: set it in src/firebase/google.ts (release builds need it)');
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID || 'autoDetect' });
  configured = true;
}

/** Returns the Firebase user credential, or null when the person closed the Google dialog. */
export async function signInGoogle() {
  try {
    configure();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    try { await GoogleSignin.signOut(); } catch {} // forget a stale session so the account picker shows

    const response: any = await GoogleSignin.signIn();
    if (response?.type === 'cancelled') return null;

    const idToken: string | null | undefined = response?.data?.idToken ?? response?.idToken;
    if (!idToken) {
      console.warn('[google] no idToken returned: check the SHA-1 in Firebase and the Web client ID');
      fail('google/no-id-token', GENERIC);
    }
    return await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken));
  } catch (e: any) {
    if (e?.code && String(e.code).startsWith('google/')) throw e; // already friendly

    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        fail('google/play-services', 'Google Play Services is missing or out of date. Please update it from the Play Store and try again.');
      }
    }

    console.warn('[google] sign-in failed', e?.code, e?.message);

    if (e?.code && String(e.code).startsWith('auth/')) fail(String(e.code), getAuthErrorMessage(e));

    const msg = String(e?.message ?? e);
    if (/network|timeout|timed out|unreachable/i.test(msg)) {
      fail('google/network', 'Please check your internet connection and try again.');
    }
    // developer error (missing SHA-1 / client ID), unknown errors: nothing the user can fix
    fail('google/unavailable', GENERIC);
  }
}

export async function signOutGoogle() {
  try { await GoogleSignin.signOut(); } catch {}
}