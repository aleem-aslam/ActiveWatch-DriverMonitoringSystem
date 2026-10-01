import React, { useContext, useState } from 'react';
import { AuthContext } from "../../context/AuthContext";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

import AuthInput from '../../components/auth/AuthInput';
import AuthButton from '../../components/auth/AuthButton';
import { signInGoogle } from '../../firebase/google';
import { loginUser } from '../../firebase/auth';
import { useTheme } from '../../theme/ThemeContext';
import { getAuthErrorMessage } from '../../utils/firebaseErrors';

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
      // navigation.navigate("Main"); — left as-is; presumably AuthContext's
      // auth-state listener drives the switch to Main automatically.
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
    if (result === null) return; // cancelled — nothing to show
  } catch (error: any) {
    Alert.alert('Google Sign-In Failed', getAuthErrorMessage(error));
  } finally {
    setGoogleLoading(false);
  }
}

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <View style={[styles.circle, { backgroundColor: colors.primary + '20' }]}>
          <Text style={styles.logo}>🚗</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Sign in to continue monitoring your driving safety
        </Text>
      </View>

      <View style={styles.form}>
        <AuthInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          editable={!busy}
        />
        <AuthInput
          placeholder="Password"
          secure
          value={password}
          onChangeText={setPassword}
          editable={!busy}
        />

        <TouchableOpacity
          style={styles.forgot}
          onPress={() => navigation.navigate('ForgotPassword')}
          disabled={busy}
        >
          <Text style={{ color: colors.primary }}>Forgot Password?</Text>
        </TouchableOpacity>

        <AuthButton title="Sign In" onPress={login} loading={loading} disabled={busy} style={{ marginBottom: 15 }} />

        <AuthButton
          title="🌈  Continue with Google"
          onPress={handleGoogleSignIn}
          loading={googleLoading}
          disabled={busy}
          variant="outline"
        />

        <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={busy} style={{ marginTop: 10 }}>
          <Text style={[styles.create, { color: colors.muted }]}>
            Don't have an account?
            <Text style={{ color: colors.primary }}> Create Account</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setGuest(true)} disabled={busy} style={{ marginTop: 25 }}>
          <Text style={{ color: colors.primary, textAlign: 'center' }}>Continue as Guest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 25, justifyContent: 'center' },
  top: { alignItems: 'center', marginBottom: 45 },
  circle: { height: 110, width: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  logo: { fontSize: 50 },
  title: { fontSize: 34, fontWeight: '700', marginBottom: 10 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  form: {},
  forgot: { alignSelf: 'flex-end', marginTop: 10, marginBottom: 20 },
  create: { textAlign: 'center', fontSize: 15 },
});