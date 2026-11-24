// src/screens/history/TripCard.tsx
// One finished trip, shown on the History screen's "Trips" tab.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDuration, type TripSummary } from '../../services/tripStore';

function Stat({ label, value, colors }: { label: string; value: number; colors: any }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: value > 0 ? colors.danger : colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

export default function TripCard({ trip: t, colors, onDelete }: { trip: TripSummary; colors: any; onDelete?: () => void }) {
  const when = new Date(t.startedAtIso);
  const total = t.drowsyEvents + t.hardBrakingEvents + t.nearMisses;
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.headRow}>
        <Text style={[styles.date, { color: colors.text }]}>
          {when.toLocaleDateString()} · {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <View style={[styles.badge, { backgroundColor: total === 0 ? '#16a34a22' : '#f59e0b22' }]}>
          <Text style={{ color: total === 0 ? '#16a34a' : '#d97706', fontSize: 12, fontWeight: '700' }}>
            {total === 0 ? 'Clean trip' : `${total} event${total === 1 ? '' : 's'}`}
          </Text>
        </View>
      </View>

      <Text style={[styles.sub, { color: colors.muted }]}>
        {formatDuration(t.durationSec)}
        {t.avgSpeedKmh !== null ? `  ·  ${t.distanceKm} km  ·  avg ${t.avgSpeedKmh} km/h  ·  max ${t.maxSpeedKmh} km/h` : '  ·  no GPS data'}
      </Text>

      <View style={styles.row}>
        <Stat label="Drowsy" value={t.drowsyEvents} colors={colors} />
        <Stat label="Hard braking" value={t.hardBrakingEvents} colors={colors} />
        <Stat label="Near misses" value={t.nearMisses} colors={colors} />
      </View>
      {onDelete && (
        <Pressable onPress={onDelete} hitSlop={8} style={styles.del}>
          <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 13 }}>Delete</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 18, marginBottom: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  sub: { fontSize: 13, marginTop: 6 },
  row: { flexDirection: 'row', marginTop: 14 },
  stat: { flex: 1 },
  del: { alignSelf: 'flex-end', marginTop: 8 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 2 },
});