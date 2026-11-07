import React, { useContext, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import AuthLayout, { FeatureRow } from '../../components/auth/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import PrimaryButton from '../../components/auth/PrimaryButton';
import { signInGoogle } from '../../firebase/google';
import { loginUser } from '../../firebase/auth';
import { useTheme } from '../../theme/ThemeContext';
import { getAuthErrorMessage } from '../../utils/firebaseErrors';

const GOOGLE_LOGO = require('../../assets/logos/google.png');

export default function LoginScreen({ navigation }: any) {
  const { setGuest } = useContext(AuthContext);
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const busy = loading || googleLoading;

  async function login() {
    if (!email.trim() || !password) {
      Alert.alert('Missing Information', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await loginUser(email.trim(), password);
      // AuthContext's auth-state listener switches to the main app.
    } catch (error: any) {
      Alert.alert('Login Failed', getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      const result = await signInGoogle();
      if (result === null) return; // cancelled
    } catch (error: any) {
      Alert.alert('Google Sign-In Failed', error?.message ? String(error.message) : getAuthErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthLayout title="ActiveWatch" subtitle="Your co-driver for safer journeys">
      <Text style={[styles.h1, { color: colors.text }]}>Welcome back</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>Sign in to continue monitoring your driving safety</Text>

      <AuthField icon="mail-outline" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" editable={!busy} returnKeyType="next" />
      <AuthField icon="lock-closed-outline" placeholder="Password" value={password} onChangeText={setPassword} secure editable={!busy} returnKeyType="go" onSubmitEditing={login} />

      <TouchableOpacity style={styles.forgot} onPress={() => navigation.navigate('ForgotPassword')} disabled={busy}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Forgot password?</Text>
      </TouchableOpacity>

      <PrimaryButton title="Sign In" onPress={login} loading={loading} disabled={busy} />

      <View style={styles.orRow}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Text style={{ color: colors.muted, marginHorizontal: 12, fontSize: 13 }}>or</Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>

      <PrimaryButton title="Continue with Google" image={GOOGLE_LOGO} outline onPress={handleGoogleSignIn} loading={googleLoading} disabled={busy} />

      <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={busy} style={{ marginTop: 22 }}>
        <Text style={[styles.center, { color: colors.muted }]}>
          Don't have an account? <Text style={{ color: colors.primary, fontWeight: '700' }}>Create one</Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setGuest(true)} disabled={busy} style={{ marginTop: 14 }}>
        <Text style={[styles.center, { color: colors.primary, fontWeight: '600' }]}>Continue as guest</Text>
      </TouchableOpacity>

      <FeatureRow colors={colors} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 14, marginTop: 4, marginBottom: 22, lineHeight: 20 },
  forgot: { alignSelf: 'flex-end', marginBottom: 18, marginTop: -2 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  center: { textAlign: 'center', fontSize: 14.5 },
});