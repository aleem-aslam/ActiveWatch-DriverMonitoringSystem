// src/screens/trips/TripSummaryScreen.tsx
// Trip summary: the trip you just finished (this session) and, for signed-in users, the
// last 20 saved trips. Register it in your navigator, or render <TripList /> inside the
// existing History screen.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useSettings } from '../../hooks/useSettings';
import { formatDuration, getLastTrip, type TripSummary } from '../../services/tripStore';
import { listTrips } from '../../firebase/tripService';

function TripCard({ t, colors }: { t: TripSummary; colors: any }) {
  const when = new Date(t.startedAtIso);
  const total = t.drowsyEvents + t.hardBrakingEvents + t.nearMisses;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.date, { color: colors.text }]}>
        {when.toLocaleDateString()} · {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        {formatDuration(t.durationSec)}
        {t.avgSpeedKmh !== null ? `  ·  ${t.distanceKm} km  ·  avg ${t.avgSpeedKmh} km/h  ·  max ${t.maxSpeedKmh} km/h` : '  ·  no GPS'}
      </Text>
      <View style={styles.row}>
        <Stat label="Drowsy" value={t.drowsyEvents} colors={colors} />
        <Stat label="Hard braking ahead" value={t.hardBrakingEvents} colors={colors} />
        <Stat label="Near misses" value={t.nearMisses} colors={colors} />
      </View>
      <Text style={{ color: total === 0 ? '#22c55e' : '#f59e0b', fontWeight: '600', marginTop: 8 }}>
        {total === 0 ? 'Clean trip' : `${total} safety event${total === 1 ? '' : 's'}`}
      </Text>
    </View>
  );
}

function Stat({ label, value, colors }: { label: string; value: number; colors: any }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: value > 0 ? '#ef4444' : colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

/** Just the list, so it can be dropped into another screen. */
export function TripList() {
  const { colors } = useTheme();
  const { uid } = useSettings();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const mine = uid ? await listTrips(uid, 20) : [];
      const lastLocal = getLastTrip();
      // the trip just finished may not be saved yet (or the user is a guest)
      const merged: TripSummary[] = [...mine];
      if (lastLocal && !mine.some((t) => t.startedAtIso === lastLocal.startedAtIso)) merged.unshift(lastLocal);
      setTrips(merged);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setTrips([]);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  if (trips === null) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {error && <Text style={{ color: '#ef4444', marginBottom: 8 }}>Could not load saved trips: {error}</Text>}
      {trips.length === 0 && (
        <Text style={{ color: colors.muted }}>
          No trips yet. {uid ? 'Start monitoring, then come back.' : 'Sign in to keep a history of your trips.'}
        </Text>
      )}
      {trips.map((t, i) => (
        <TripCard key={t.startedAtIso + i} t={t} colors={colors} />
      ))}
    </ScrollView>
  );
}

export default function TripSummaryScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Text style={[styles.title, { color: colors.text }]}>Trip summary</Text>
      <TripList />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', paddingHorizontal: 16, paddingTop: 56 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  date: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', marginTop: 12 },
  stat: { flex: 1 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12 },
});