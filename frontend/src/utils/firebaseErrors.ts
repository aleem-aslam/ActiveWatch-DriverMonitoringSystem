/**
 * Maps Firebase Auth error codes to plain, user-facing messages.
 *
 * Two deliberate choices here, both standard practice:
 * 1. Never show error.message directly — it's an internal Firebase string
 *    that looks broken to a user and leaks implementation details.
 * 2. "Wrong password" and "no such user" get the SAME message during
 *    login. Distinguishing them lets an attacker probe which emails are
 *    registered (account enumeration) — a real, commonly-cited issue.
 */
import { statusCodes } from '@react-native-google-signin/google-signin';
export function getAuthErrorMessage(error: any): string {
  const code: string = error?.code || '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';

    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please try again.';

    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';

    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';

    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';

    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';

    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';

    case 'auth/operation-not-allowed':
      return 'This sign-in method is currently unavailable. Please contact support.';

    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    
    case statusCodes.IN_PROGRESS:
        return 'A sign-in is already in progress.';
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return 'Google Play Services is required for this on your device.';

    default:
      return 'Something went wrong. Please try again.';
  }
}