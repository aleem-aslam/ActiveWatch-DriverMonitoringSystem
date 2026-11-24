import React, { useContext, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import { useTheme } from "../../theme/ThemeContext";
import { AuthContext } from "../../context/AuthContext";
import { logoutUser } from "../../firebase/auth";
import { updateUserDocument } from "../../firebase/userService";

interface EditForm {
  fullName: string;
  phone: string;
  age: string;
  gender: string;
  experienceYears: string;
  licenseNumber: string;
  licenseExpiry: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleRegistration: string;
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const { user, profile: userDoc, loading, guest, setGuest, refreshProfile } =
    useContext(AuthContext);

  const loggedIn = Boolean(user);
  const driverProfile = userDoc?.driverProfile;
  const vehicle = userDoc?.vehicle;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditForm>({
    fullName: "",
    phone: "",
    age: "",
    gender: "",
    experienceYears: "0",
    licenseNumber: "",
    licenseExpiry: "",
    vehicleBrand: "",
    vehicleModel: "",
    vehicleYear: "",
    vehicleRegistration: "",
  });

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const startEditing = () => {
    setForm({
      fullName: userDoc?.fullName || "",
      phone: userDoc?.phone || "",
      age: driverProfile?.age || "",
      gender: driverProfile?.gender || "",
      experienceYears: String(driverProfile?.experienceYears ?? 0),
      licenseNumber: driverProfile?.licenseNumber || "",
      licenseExpiry: driverProfile?.licenseExpiry || "",
      vehicleBrand: vehicle?.brand || "",
      vehicleModel: vehicle?.model || "",
      vehicleYear: vehicle?.year || "",
      vehicleRegistration: vehicle?.registrationNumber || "",
    });
    setIsEditing(true);
  };

  const cancelEditing = () => setIsEditing(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Dot-notation keys so Firestore merges these leaf fields instead of
      // overwriting the whole driverProfile/vehicle maps.
      await updateUserDocument(user.uid, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        "driverProfile.age": form.age.trim(),
        "driverProfile.gender": form.gender.trim(),
        "driverProfile.experienceYears": Number(form.experienceYears) || 0,
        "driverProfile.licenseNumber": form.licenseNumber.trim(),
        "driverProfile.licenseExpiry": form.licenseExpiry.trim(),
        "vehicle.brand": form.vehicleBrand.trim(),
        "vehicle.model": form.vehicleModel.trim(),
        "vehicle.year": form.vehicleYear.trim(),
        "vehicle.registrationNumber": form.vehicleRegistration.trim(),
      });
      await refreshProfile();
      setIsEditing(false);
    } catch (error) {
      // TODO: surface this to the user (toast/alert) instead of just logging
      console.warn("Failed to update profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.warn("Logout failed:", error);
    }
  };

  const inputStyle = [
    styles.input,
    { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
  ];

  const renderField = (label: string, value: string, onChange: (v: string) => void, opts: { keyboardType?: any; autoCapitalize?: any } = {}) => (
    <>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        style={inputStyle}
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={colors.muted}
        keyboardType={opts.keyboardType}
        autoCapitalize={opts.autoCapitalize}
      />
    </>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + 20, paddingBottom: tabBarHeight + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>

        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          <Text style={styles.avatar}>{loggedIn ? "👤" : "🚗"}</Text>
          <Text style={[styles.name, { color: colors.text }]}>
            {loggedIn ? userDoc?.fullName || user?.email : "Guest User"}
          </Text>
          <Text style={[styles.email, { color: colors.muted }]}>
            {loggedIn ? user?.email : "Using ActiveWatch without account"}
          </Text>
        </View>

        {loggedIn ? (
          <>
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.heading, { color: colors.text }]}>Account Details</Text>

              {isEditing ? (
                <>
                  {renderField("Full Name", form.fullName, (v) => setForm((f) => ({ ...f, fullName: v })))}
                  {renderField("Phone", form.phone, (v) => setForm((f) => ({ ...f, phone: v })), { keyboardType: "phone-pad" })}
                </>
              ) : (
                <Text style={[styles.item, { color: colors.muted }]}>
                  Phone: {userDoc?.phone || "Not added"}
                </Text>
              )}

              <Text style={[styles.item, { color: colors.muted }]}>
                Provider: {userDoc?.provider || "password"}
              </Text>
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.heading, { color: colors.text }]}>Driver Profile</Text>

              {isEditing ? (
                <>
                  {renderField("Age", form.age, (v) => setForm((f) => ({ ...f, age: v })), { keyboardType: "numeric" })}
                  {renderField("Gender", form.gender, (v) => setForm((f) => ({ ...f, gender: v })))}
                  {renderField("Experience (years)", form.experienceYears, (v) => setForm((f) => ({ ...f, experienceYears: v.replace(/[^0-9]/g, "") })), { keyboardType: "numeric" })}
                  {renderField("License Number", form.licenseNumber, (v) => setForm((f) => ({ ...f, licenseNumber: v })), { autoCapitalize: "characters" })}
                  {renderField("License Expiry", form.licenseExpiry, (v) => setForm((f) => ({ ...f, licenseExpiry: v })))}
                </>
              ) : (
                <>
                  <Text style={[styles.item, { color: colors.muted }]}>Age: {driverProfile?.age || "Not added"}</Text>
                  <Text style={[styles.item, { color: colors.muted }]}>Gender: {driverProfile?.gender || "Not added"}</Text>
                  <Text style={[styles.item, { color: colors.muted }]}>
                    Experience: {driverProfile?.experienceYears || 0} years
                  </Text>
                  <Text style={[styles.item, { color: colors.muted }]}>
                    License: {driverProfile?.licenseNumber || "Not added"}
                  </Text>
                  <Text style={[styles.item, { color: colors.muted }]}>
                    License Expiry: {driverProfile?.licenseExpiry || "Not added"}
                  </Text>
                </>
              )}
            </View>

            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.heading, { color: colors.text }]}>Vehicle</Text>

              {isEditing ? (
                <>
                  {renderField("Brand", form.vehicleBrand, (v) => setForm((f) => ({ ...f, vehicleBrand: v })))}
                  {renderField("Model", form.vehicleModel, (v) => setForm((f) => ({ ...f, vehicleModel: v })))}
                  {renderField("Year", form.vehicleYear, (v) => setForm((f) => ({ ...f, vehicleYear: v })), { keyboardType: "numeric" })}
                  {renderField("Registration Number", form.vehicleRegistration, (v) => setForm((f) => ({ ...f, vehicleRegistration: v })), { autoCapitalize: "characters" })}
                </>
              ) : (
                <>
                  <Text style={[styles.item, { color: colors.muted }]}>
                    {vehicle?.brand || vehicle?.model ? `${vehicle?.brand || ""} ${vehicle?.model || ""}`.trim() : "Not added"}
                  </Text>
                  <Text style={[styles.item, { color: colors.muted }]}>Year: {vehicle?.year || "Not added"}</Text>
                  <Text style={[styles.item, { color: colors.muted }]}>
                    Registration: {vehicle?.registrationNumber || "Not added"}
                  </Text>
                </>
              )}
            </View>

            {isEditing ? (
              <View style={styles.editActionsRow}>
                <TouchableOpacity
                  style={[styles.outlineButton, styles.halfButton, { borderColor: colors.muted }]}
                  onPress={cancelEditing}
                  disabled={saving}
                  accessibilityRole="button"
                >
                  <Text style={{ color: colors.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    styles.halfButton,
                    { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 },
                  ]}
                  onPress={handleSaveProfile}
                  disabled={saving}
                  accessibilityRole="button"
                >
                  <Text style={styles.buttonText}>{saving ? "Saving…" : "Save Changes"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={startEditing}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>Edit Profile</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.dangerButton, { backgroundColor: colors.danger }]}
              onPress={handleLogout}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.heading, { color: colors.text }]}>Guest Mode</Text>
              <Text style={[styles.item, { color: colors.muted }]}>
                Sign in or create an account to save:
              </Text>
              <Text style={[styles.item, { color: colors.muted }]}>✓ Driving history</Text>
              <Text style={[styles.item, { color: colors.muted }]}>✓ Accident records</Text>
              <Text style={[styles.item, { color: colors.muted }]}>✓ Personal settings</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => setGuest(false)}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: colors.primary }]}
              onPress={() => setGuest(false)}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.primary }}>Create Account</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  contentContainer: { padding: 25 },
  title: { fontSize: 34, fontWeight: "700" },
  profileCard: { marginTop: 30, padding: 25, borderRadius: 25, alignItems: "center" },
  avatar: { fontSize: 55 },
  name: { fontSize: 24, fontWeight: "700", marginTop: 15 },
  email: { marginTop: 8 },
  section: { marginTop: 20, padding: 22, borderRadius: 20 },
  heading: { fontSize: 20, fontWeight: "700" },
  item: { marginTop: 12, fontSize: 15 },
  label: { marginTop: 12, fontSize: 13, fontWeight: "600" },
  input: {
    marginTop: 6,
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  primaryButton: { height: 55, borderRadius: 30, alignItems: "center", justifyContent: "center", marginTop: 25 },
  dangerButton: { height: 55, borderRadius: 30, alignItems: "center", justifyContent: "center", marginTop: 15 },
  outlineButton: { height: 55, borderRadius: 30, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 15 },
  editActionsRow: { flexDirection: "row", gap: 12, marginTop: 25 },
  halfButton: { flex: 1, marginTop: 0 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});