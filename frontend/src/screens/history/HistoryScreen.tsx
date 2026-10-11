// src/screens/history/HistoryScreen.tsx
// Two tabs:
//   Events  drowsiness events and road warnings (with the photo that was taken, tap to enlarge)
//   Trips   one card per monitoring session (duration, distance, event counts)
//
// Built to be simple for the native layer: no per-row animations, each tab is its own list
// (own key), and the empty/header views are plain elements, not functions created on every
// render. Signed-in users get live data from Firestore; guests only see the trip they just
// finished (kept in memory).
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { useTheme } from '../../theme/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { deleteHistoryEvent, subscribeToHistory, type HistoryEvent } from '../../firebase/historyService';
import { deleteTrip, subscribeToTrips } from '../../firebase/tripService';
import { getLastTrip, type TripSummary } from '../../services/tripStore';
import TripCard from './TripCard';

type Tab = 'events' | 'trips';

const KIND_TITLE: Record<HistoryEvent['kind'], string> = {
  DROWSY: 'Drowsiness detected',
  APPROACHING: 'Collision warning',
  CROSSING: 'Vehicle crossing',
  HARD_BRAKING: 'Sudden braking ahead',
  TAILGATING: 'Following too close',
};

type KindFilter = 'all' | 'drowsy' | 'road' | 'photo';
type TimeFilter = 'today' | 'week' | 'all';
const KIND_CHIPS: { k: KindFilter; label: string }[] = [
  { k: 'all', label: 'All' }, { k: 'drowsy', label: 'Drowsiness' }, { k: 'road', label: 'Road warnings' }, { k: 'photo', label: 'With photo' },
];
const TIME_CHIPS: { k: TimeFilter; label: string }[] = [
  { k: 'today', label: 'Today' }, { k: 'week', label: '7 days' }, { k: 'all', label: 'All time' },
];
function inTime(d: Date, f: TimeFilter) {
  if (f === 'all') return true;
  const start = new Date();
  if (f === 'today') start.setHours(0, 0, 0, 0);
  else start.setTime(Date.now() - 7 * 86400000);
  return d.getTime() >= start.getTime();
}

function Chips<T extends string>({ items, value, onChange, colors }: { items: { k: T; label: string }[]; value: T; onChange: (k: T) => void; colors: any }) {
  return (
    <View style={styles.chipRow}>
      {items.map((c) => (
        <Pressable key={c.k} onPress={() => onChange(c.k)} style={[styles.chip, { backgroundColor: value === c.k ? colors.primary : colors.card }]}>
          <Text style={{ color: value === c.k ? '#fff' : colors.text, fontSize: 12.5, fontWeight: '600' }}>{c.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function EventCard({ ev, colors, onDelete }: { ev: HistoryEvent; colors: any; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  const bits: string[] = [];
  if (ev.eyesClosedMs !== null) bits.push(`Eyes closed ${(ev.eyesClosedMs / 1000).toFixed(1)} s`);
  if (ev.ttcSeconds !== null) bits.push(`TTC ${ev.ttcSeconds.toFixed(1)} s`);
  if (ev.distanceMeters !== null) bits.push(`~${ev.distanceMeters.toFixed(0)} m ahead`);
  if (ev.leadSpeedKmh !== null) bits.push(`car ahead ${ev.leadSpeedKmh.toFixed(0)} km/h`);
  if (ev.ownSpeedKmh !== null) bits.push(`you ${ev.ownSpeedKmh.toFixed(0)} km/h`);
  const uri = ev.imageBase64 ? `data:image/jpeg;base64,${ev.imageBase64}` : null;
  const isDrowsy = ev.kind === 'DROWSY';

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.eventRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[styles.eventTitle, { color: isDrowsy ? colors.danger : '#f59e0b' }]}>{KIND_TITLE[ev.kind]}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>{ev.at.toLocaleString()}</Text>
          {bits.length > 0 && <Text style={[styles.meta, { color: colors.muted }]}>{bits.join('  ·  ')}</Text>}
          {ev.latitude !== null && ev.longitude !== null && (
            <Text style={[styles.meta, { color: colors.muted }]}>
              Location {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}
            </Text>
          )}
        </View>
        {uri && !open && (
          <Pressable onPress={() => setOpen(true)}>
            <Image source={{ uri }} style={styles.thumb} />
          </Pressable>
        )}
      </View>
      {onDelete && (
        <Pressable onPress={onDelete} hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
          <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 13 }}>Delete</Text>
        </Pressable>
      )}
      {uri && open && (
        <Pressable onPress={() => setOpen(false)}>
          <Image source={{ uri }} style={styles.big} resizeMode="contain" />
          <Text style={[styles.meta, { color: colors.muted, textAlign: 'center' }]}>Tap to shrink</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, guest, loading: authLoading } = useContext(AuthContext) as any;
  const uid: string | null = user?.uid ?? null;

  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindF, setKindF] = useState<KindFilter>('all');
  const [timeF, setTimeF] = useState<TimeFilter>('all');

  useEffect(() => {
    if (!uid) {
      setEvents([]);
      const last = getLastTrip();
      setTrips(last ? [last] : []);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsubEvents = subscribeToHistory(
      uid,
      (list) => {
        setEvents(list);
        setLoading(false);
      },
      (e) => {
        setError(e?.message ?? String(e));
        setLoading(false);
      }
    );
    const unsubTrips = subscribeToTrips(
      uid,
      (list) => setTrips(list),
      (e) => setError(e?.message ?? String(e))
    );
    return () => {
      unsubEvents();
      unsubTrips();
    };
  }, [uid]);

  const shownEvents = events.filter((e) =>
    inTime(e.at, timeF) &&
    (kindF === 'all' || (kindF === 'drowsy' ? e.kind === 'DROWSY' : kindF === 'road' ? e.kind !== 'DROWSY' : e.imageBase64 !== null))
  );
  const shownTrips = trips.filter((t) => inTime(new Date(t.startedAtIso), timeF));

  function confirm(title: string, msg: string, run: () => Promise<any>) {
    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => run().catch((e) => setError(e?.message ?? String(e))),
      },
    ]);
  }
  const delEvent = (ev: HistoryEvent) => uid && confirm('Delete this event?', 'This cannot be undone.', () => deleteHistoryEvent(uid, ev));
  const delTrip = (t: any) => uid && t.id && confirm('Delete this trip?', 'This cannot be undone.', () => deleteTrip(uid, t.id));
  const delAll = () => {
    if (!uid) return;
    if (tab === 'events') confirm(`Delete ${shownEvents.length} shown event(s)?`, 'Only the events matching the current filter are deleted.', () => Promise.all(shownEvents.map((e) => deleteHistoryEvent(uid, e))));
    else confirm(`Delete ${shownTrips.length} shown trip(s)?`, 'Only the trips matching the current filter are deleted.', () => Promise.all(shownTrips.map((t: any) => (t.id ? deleteTrip(uid, t.id) : Promise.resolve()))));
  };
  const shownCount = tab === 'events' ? shownEvents.length : shownTrips.length;

  const busy = authLoading || (Boolean(uid) && loading);

  const emptyTitle = tab === 'events' ? 'No events yet' : 'No trips yet';
  const emptyText = !uid
    ? tab === 'events'
      ? 'Sign in to keep your drowsiness events and collision warnings across sessions.'
      : 'Sign in to keep a history of your trips. The trip you just finished shows here until you close the app.'
    : tab === 'events'
    ? 'Warnings and drowsiness events appear here after a monitoring session.'
    : 'Finished monitoring sessions appear here (sessions shorter than 20 seconds are skipped).';

  const empty = (
    <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
      <Text style={{ color: colors.text, fontSize: 20 }}>{!uid && guest ? 'Guest Mode' : emptyTitle}</Text>
      <Text style={{ color: colors.muted, marginTop: 10, textAlign: 'center' }}>{emptyText}</Text>
    </View>
  );

  const listPadding = { paddingBottom: tabBarHeight + 24, paddingHorizontal: 25, flexGrow: 1 };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
      <Text style={[styles.title, { color: colors.text }]}>History</Text>

      <View style={[styles.segment, { backgroundColor: colors.card }]}>
        {(['events', 'trips'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.segBtn, tab === t && { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: tab === t ? '#fff' : colors.text, fontWeight: '600' }}>
              {t === 'events' ? 'Events' : 'Trips'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ paddingHorizontal: 25 }}>
        {tab === 'events' && <Chips items={KIND_CHIPS} value={kindF} onChange={setKindF} colors={colors} />}
        <Chips items={TIME_CHIPS} value={timeF} onChange={setTimeF} colors={colors} />
        {uid && shownCount > 0 && (
          <Pressable onPress={delAll} hitSlop={8} style={{ alignSelf: 'flex-end', marginBottom: 6 }}>
            <Text style={{ color: colors.danger, fontSize: 12.5, fontWeight: '600' }}>Delete all shown ({shownCount})</Text>
          </Pressable>
        )}
      </View>

      {error && <Text style={styles.error}>Could not load everything: {error}</Text>}

      {busy ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : tab === 'events' ? (
        <FlatList
          key="events"
          data={shownEvents}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => <EventCard ev={item} colors={colors} onDelete={uid ? () => delEvent(item) : undefined} />}
          contentContainerStyle={listPadding}
          ListEmptyComponent={empty}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          key="trips"
          data={shownTrips}
          keyExtractor={(t, i) => t.startedAtIso + i}
          renderItem={({ item }) => <TripCard trip={item} colors={colors} onDelete={uid && (item as any).id ? () => delTrip(item) : undefined} />}
          contentContainerStyle={listPadding}
          ListEmptyComponent={empty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  segment: { flexDirection: 'row', alignSelf: 'center', borderRadius: 22, padding: 4, marginTop: 14, marginBottom: 12 },
  segBtn: { paddingHorizontal: 28, paddingVertical: 9, borderRadius: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginRight: 8, marginBottom: 6 },
  error: { color: '#ef4444', textAlign: 'center', marginHorizontal: 25, marginBottom: 10, fontSize: 12 },
  loadingWrap: { marginTop: 60, alignItems: 'center' },
  emptyCard: { marginTop: 30, padding: 30, borderRadius: 20, alignItems: 'center' },
  card: { padding: 18, borderRadius: 18, marginBottom: 14 },
  eventRow: { flexDirection: 'row', alignItems: 'center' },
  eventTitle: { fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 5, fontSize: 12.5, lineHeight: 17 },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#0002' },
  big: { width: '100%', height: 260, marginTop: 12, borderRadius: 12, backgroundColor: '#000' },
});