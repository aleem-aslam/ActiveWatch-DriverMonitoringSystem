import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { registerUser } from '../../firebase/auth';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import PrimaryButton from '../../components/auth/PrimaryButton';
import { useTheme } from '../../theme/ThemeContext';
import { getAuthErrorMessage } from '../../utils/firebaseErrors';

export default function RegisterScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email.trim() || !password) {
      Alert.alert('Missing Information', 'Please fill all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords Don't Match", 'Please make sure both passwords are the same.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password should be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await registerUser(email.trim(), password);
      // AuthContext's listener creates the user document and switches to the main app.
      Alert.alert('Success', 'Account created successfully');
    } catch (error: any) {
      Alert.alert('Registration Failed', getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create account" subtitle="Join ActiveWatch and monitor your driving safety" icon="person-add" compact>
      <AuthField icon="mail-outline" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" editable={!loading} returnKeyType="next" />
      <AuthField icon="lock-closed-outline" placeholder="Password (6+ characters)" value={password} onChangeText={setPassword} secure editable={!loading} returnKeyType="next" />
      <AuthField icon="shield-checkmark-outline" placeholder="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secure editable={!loading} returnKeyType="go" onSubmitEditing={handleRegister} />

      <PrimaryButton title="Create Account" onPress={handleRegister} loading={loading} />

      <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading} style={{ marginTop: 22 }}>
        <Text style={[styles.center, { color: colors.muted }]}>
          Already have an account? <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text>
        </Text>
      </TouchableOpacity>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({ center: { textAlign: 'center', fontSize: 14.5 } });