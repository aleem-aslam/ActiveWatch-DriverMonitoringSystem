import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import AuthInput from '../../components/auth/AuthInput';
import AuthButton from '../../components/auth/AuthButton';
import { forgotPassword } from '../../firebase/auth';
import { useTheme } from '../../theme/ThemeContext';
import { getAuthErrorMessage } from '../../utils/firebaseErrors';

export default function ForgotPasswordScreen({ navigation }: any) {
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  async function handleReset() {
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (error: any) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Check Your Inbox</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          If an account exists for {email.trim()}, we've sent a link to reset your password.
        </Text>
        <AuthButton title="Back to Login" onPress={() => navigation.navigate('Login')} style={{ marginTop: 30 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Reset Password</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Enter your email and we'll send you a link to reset your password.
      </Text>

      <AuthInput
        placeholder="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (errorMessage) setErrorMessage(null);
        }}
        keyboardType="email-address"
        editable={!loading}
      />

      {errorMessage ? (
        <Text style={[styles.error, { color: colors.danger }]}>{errorMessage}</Text>
      ) : null}

      <AuthButton title="Send Email" onPress={handleReset} loading={loading} style={{ marginTop: 10 }} />

      <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading} style={{ marginTop: 25 }}>
        <Text style={{ color: colors.primary, textAlign: 'center' }}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 30 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 10 },
  subtitle: { fontSize: 15, marginBottom: 30, lineHeight: 21 },
  error: { fontSize: 14, marginBottom: 10, marginTop: -5 },
});