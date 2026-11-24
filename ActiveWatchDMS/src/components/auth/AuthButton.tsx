import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
  style?: ViewStyle;
}

export default function AuthButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: AuthButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.button,
        isOutline
          ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary }
          : { backgroundColor: colors.primary },
        isDisabled && { opacity: 0.6 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.text, { color: isOutline ? colors.primary : '#fff' }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { height: 55, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 17, fontWeight: '600' },
});