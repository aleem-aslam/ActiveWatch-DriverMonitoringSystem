import React, { useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { useTheme } from '../../theme/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { subscribeToIncidents, DrowsinessIncident } from '../../firebase/incidentService';

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return date.toLocaleString();
}

function IncidentRow({ item, index, colors }: { item: DrowsinessIncident; index: number; colors: any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.incidentCard, { backgroundColor: colors.card, opacity, transform: [{ translateY }] }]}>
      <Text style={[styles.incidentTitle, { color: colors.danger }]}>Drowsiness Detected</Text>
      <Text style={[styles.incidentMeta, { color: colors.muted }]}>{formatTimestamp(item.timestamp)}</Text>
      <Text style={[styles.incidentMeta, { color: colors.muted }]}>
        Eyes closed for {(item.eyesClosedForMs / 1000).toFixed(1)}s · EAR {item.ear.toFixed(3)}
      </Text>
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const { user, guest, loading: authLoading } = useContext(AuthContext);
  const loggedIn = Boolean(user);

  const [incidents, setIncidents] = useState<DrowsinessIncident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!user) {
      setIncidents([]);
      setLoadingIncidents(false);
      return;
    }
    setLoadingIncidents(true);
    const unsubscribe = subscribeToIncidents(user.uid, (data) => {
      setIncidents(data);
      setLoadingIncidents(false);
    });
    return unsubscribe;
  }, [user?.uid]);

  const isBusy = authLoading || (loggedIn && loadingIncidents);

  const emptyState = () => {
    if (isBusy) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (!loggedIn) {
      return (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontSize: 20 }}>{guest ? 'Guest Mode' : 'Not Signed In'}</Text>
          <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>
            Sign in to view your drowsiness history across sessions.
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={{ color: colors.text, fontSize: 20 }}>No drowsy events yet</Text>
        <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>
          Detected events will appear here after monitoring sessions.
        </Text>
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fade }]}>
      <FlatList
        data={!isBusy && loggedIn ? incidents : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <IncidentRow item={item} index={index} colors={colors} />}
        contentContainerStyle={{ paddingTop: insets.top + 40, paddingBottom: tabBarHeight + 24, paddingHorizontal: 25, flexGrow: 1 }}
        ListHeaderComponent={<Text style={[styles.title, { color: colors.text }]}>Drowsy History</Text>}
        ListEmptyComponent={emptyState}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  card: { marginTop: 60, padding: 30, borderRadius: 20, alignItems: 'center' },
  loadingWrap: { marginTop: 60, alignItems: 'center' },
  incidentCard: { padding: 20, borderRadius: 18, marginBottom: 14 },
  incidentTitle: { fontSize: 16, fontWeight: '700' },
  incidentMeta: { marginTop: 6, fontSize: 13 },
});