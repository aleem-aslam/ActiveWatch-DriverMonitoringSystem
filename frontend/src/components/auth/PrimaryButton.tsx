// src/components/auth/PrimaryButton.tsx
// Big rounded button for the auth screens (filled or outlined, optional left image/icon).
import React from 'react';
import { ActivityIndicator, Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  outline?: boolean;
  image?: ImageSourcePropType;
};

export default function PrimaryButton({ title, onPress, loading, disabled, outline, image }: Props) {
  const { colors } = useTheme();
  const fg = outline ? colors.text : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        outline
          ? { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }
          : { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
        { opacity: disabled && !loading ? 0.55 : pressed ? 0.88 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={outline ? colors.primary : '#fff'} />
      ) : (
        <View style={styles.row}>
          {image ? <Image source={image} style={styles.img} /> : null}
          <Text style={[styles.text, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  img: { width: 22, height: 22, marginRight: 12 },
  text: { fontSize: 16.5, fontWeight: '700' },
});