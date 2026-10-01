import React from 'react';
import { TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface AuthInputProps extends Pick<TextInputProps, 'keyboardType' | 'autoCapitalize' | 'editable'> {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secure?: boolean;
}

export default function AuthInput({
  placeholder,
  value,
  onChangeText,
  secure = false,
  keyboardType,
  autoCapitalize = 'none', // fixes the auto-capitalized-email bug described above
  editable = true,
}: AuthInputProps) {
  const { colors } = useTheme();

  return (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secure}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      editable={editable}
      style={[
        styles.input,
        { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: { height: 55, borderWidth: 1, borderRadius: 28, paddingHorizontal: 20, fontSize: 16, marginBottom: 15 },
});