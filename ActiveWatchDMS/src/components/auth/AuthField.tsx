// src/components/auth/AuthField.tsx
// Text field with a leading icon, focus highlight and (for passwords) a show/hide eye.
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address';
  editable?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: 'next' | 'done' | 'go';
};

export default function AuthField({ icon, placeholder, value, onChangeText, secure, keyboardType, editable = true, onSubmitEditing, returnKeyType }: Props) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: colors.card, borderColor: focus ? colors.primary : colors.border, borderWidth: focus ? 1.5 : 1 },
      ]}
    >
      <Ionicons name={icon as any} size={20} color={focus ? colors.primary : colors.muted} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!!secure && hidden}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        editable={editable}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
      />
      {secure && (
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
          <Ionicons name={(hidden ? 'eye-outline' : 'eye-off-outline') as any} size={20} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16, paddingHorizontal: 16, marginBottom: 14 },
  input: { flex: 1, fontSize: 16, marginLeft: 12, paddingVertical: 0 },
});