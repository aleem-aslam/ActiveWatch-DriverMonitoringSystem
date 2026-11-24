// Renders the themed dialog. Mounted once inside AuthLayout (login/register screens).
// To use the same dialog everywhere, also mount <ThemedAlertHost /> once near the app root,
// inside the ThemeProvider, and call showAlert(...) instead of Alert.alert(...).
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../theme/ThemeContext';
import { AlertButton, hideAlert, registerHost, useActiveAlert, useIsPrimaryHost } from './alertStore';

const SUCCESS = '#16a34a';
const WARNING = '#f59e0b';

export default function ThemedAlertHost() {
  const alert = useActiveAlert();
  const hostId = useRef(Symbol('alert-host')).current;
  useEffect(() => registerHost(hostId), [hostId]);
  const primary = useIsPrimaryHost(hostId);
  const { colors } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!alert) return;
    fade.setValue(0);
    scale.setValue(0.92);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert?.id]);

  if (!alert || !primary) return null;

  const type = alert.type ?? 'info';
  const accent =
    type === 'error' ? colors.danger ?? '#dc2626' : type === 'success' ? SUCCESS : type === 'warning' ? WARNING : colors.primary;
  const icon = type === 'error' ? 'alert-circle' : type === 'success' ? 'checkmark-circle' : type === 'warning' ? 'warning' : 'information-circle';
  const buttons: AlertButton[] = alert.buttons?.length ? alert.buttons : [{ text: 'OK' }];

  const press = (b: AlertButton) => {
    hideAlert();
    b.onPress?.();
  };

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={hideAlert}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={hideAlert} />
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale }] },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: accent + '22' }]}>
            <Ionicons name={icon as any} size={34} color={accent} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{alert.title}</Text>
          {alert.message ? <Text style={[styles.message, { color: colors.muted }]}>{alert.message}</Text> : null}

          <View style={[styles.buttons, buttons.length > 1 && { flexDirection: 'row' }]}>
            {buttons.map((b, i) => {
              const cancel = b.style === 'cancel';
              const destructive = b.style === 'destructive';
              const bg = cancel ? 'transparent' : destructive ? colors.danger ?? '#dc2626' : accent;
              return (
                <Pressable
                  key={i}
                  onPress={() => press(b)}
                  style={({ pressed }) => [
                    styles.btn,
                    buttons.length > 1 && { flex: 1, marginHorizontal: 4 },
                    { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
                    cancel && { borderWidth: 1, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.btnText, { color: cancel ? colors.text : '#fff' }]}>{b.text}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 380, borderRadius: 26, borderWidth: 1, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 18,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16,
  },
  iconWrap: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  buttons: { alignSelf: 'stretch', marginTop: 20 },
  btn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
});