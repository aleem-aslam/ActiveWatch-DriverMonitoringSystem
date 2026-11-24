import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import PrimaryButton from '../../components/auth/PrimaryButton';
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
    if (!email.trim()) return setErrorMessage('Please enter your email address.');
    if (!isValidEmail(email.trim())) return setErrorMessage('Please enter a valid email address.');
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
      <AuthLayout title="Check your inbox" subtitle="We sent you a reset link" icon="mail-open" compact>
        <Text style={[styles.body, { color: colors.muted }]}>
          If an account exists for {email.trim()}, we've sent a link to reset your password.
        </Text>
        <PrimaryButton title="Back to Login" onPress={() => navigation.navigate('Login')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset password" subtitle="Enter your email and we'll send you a reset link" icon="key" compact>
      <AuthField
        icon="mail-outline"
        placeholder="Email"
        value={email}
        onChangeText={(v) => { setEmail(v); if (errorMessage) setErrorMessage(null); }}
        keyboardType="email-address"
        editable={!loading}
        returnKeyType="go"
        onSubmitEditing={handleReset}
      />
      {errorMessage ? <Text style={[styles.error, { color: colors.danger }]}>{errorMessage}</Text> : null}

      <PrimaryButton title="Send Email" onPress={handleReset} loading={loading} />

      <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading} style={{ marginTop: 22 }}>
        <Text style={{ color: colors.primary, textAlign: 'center', fontWeight: '600' }}>Back to login</Text>
      </TouchableOpacity>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  error: { fontSize: 14, marginBottom: 12, marginTop: -4 },
});