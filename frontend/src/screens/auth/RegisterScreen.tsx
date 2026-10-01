import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";

import { registerUser } from "../../firebase/auth";
import AuthInput from "../../components/auth/AuthInput";
import AuthButton from "../../components/auth/AuthButton";
import { useTheme } from "../../theme/ThemeContext";
import { getAuthErrorMessage } from "../../utils/firebaseErrors";

export default function RegisterScreen({ navigation }: any) {
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email.trim() || !password) {
      Alert.alert("Missing Information", "Please fill all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords Don't Match", "Please make sure both passwords are the same.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak Password", "Password should be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await registerUser(email.trim(), password);
      // Note: createUserDocument() isn't called here — AuthContext's
      // subscribeAuth listener already calls it for every sign-in,
      // including this new one, so calling it again here was redundant.
      Alert.alert("Success", "Account created successfully");
    //   navigation.replace("Main");
    } catch (error: any) {
      Alert.alert("Registration Failed", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Join ActiveWatch and monitor your driving safety
      </Text>

      <AuthInput placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" editable={!loading} />
      <AuthInput placeholder="Password" value={password} onChangeText={setPassword} secure editable={!loading} />
      <AuthInput placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secure editable={!loading} />

      <AuthButton title="Create Account" onPress={handleRegister} loading={loading} style={{ marginTop: 10 }} />

      <TouchableOpacity onPress={() => navigation.navigate("Login")} disabled={loading} style={{ marginTop: 25 }}>
        <Text style={{ color: colors.primary, textAlign: "center" }}>Already have an account? Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "700", marginBottom: 10 },
  subtitle: { fontSize: 15, marginBottom: 40 },
});