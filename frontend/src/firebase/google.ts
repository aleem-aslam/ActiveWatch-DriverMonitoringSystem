import {
  GoogleSignin,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';

import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';

GoogleSignin.configure({
  webClientId: '685443010530-9brso6r3p4cjedf3arctk14gess23erm.apps.googleusercontent.com',
});

/**
 * Returns the Firebase user credential on success, or `null` if the user
 * simply cancelled the account picker — that's normal, not an error, so
 * callers shouldn't show an error alert for a null return.
 */
export async function signInGoogle() {
  await GoogleSignin.hasPlayServices();

  const response = await GoogleSignin.signIn();

  if (!isSuccessResponse(response)) {
    return null; // user cancelled
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error('Google sign-in did not return an ID token.');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(getAuth(), credential);
}