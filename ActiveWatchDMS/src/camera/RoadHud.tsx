// src/camera/RoadHud.tsx
// The on-screen controls of the rear-camera (road) screen:
//   top      close button | status pill | your speed
//   warning  one clear card when something is wrong (red = act now, amber = caution)
//   bottom   glass panel: distance ahead | time to collision | speed of the car ahead
// Long-press the status pill to show technical details (fps, boxes, model score).
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CollisionSnapshot } from '../ml/collision/ttcEstimator';
import type { DepartureState } from '../ml/collision/laneDeparture';

const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GLASS = 'rgba(15,23,42,0.72)';

export type RoadHudProps = {
  top: number; // safe-area top inset
  bottom: number; // safe-area bottom inset
  road: CollisionSnapshot;
  ready: boolean;
  ownKmh: number | null;
  speedSource: string; // "GPS", "TEST 60 km/h", "GPS off" ...
  laneFound: boolean;
  mountMessage: string | null;
  departure: DepartureState;
  visibility: 'normal' | 'night' | 'lowvis';
  eco: boolean;
  gapLimitSeconds: number;
  showDetails: boolean;
  details: string;
  onClose: () => void;
  onCycleSpeed: () => void;
  onToggleDetails: () => void;
};

function tone(level: CollisionSnapshot['level']) {
  return level === 'COLLISION' ? RED : level === 'CAUTION' ? AMBER : GREEN;
}

function Tile({ label, value, unit, color }: { label: string; value: string; unit?: string; color: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color }]} numberOfLines={1}>
        {value}
        {unit ? <Text style={styles.tileUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export default function RoadHud(p: RoadHudProps) {
  const { road } = p;
  const color = tone(road.level);
  const warning = road.level !== 'SAFE' && road.reason !== 'NONE';

  // gentle pulse on the warning card
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (road.level !== 'COLLISION') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.78, duration: 350, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 350, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [road.level, pulse]);

  const status = !p.ready ? 'Starting…' : road.level === 'COLLISION' ? 'Warning' : road.level === 'CAUTION' ? 'Caution' : 'All clear';
  const statusColor = !p.ready ? '#94a3b8' : color;

  const dist = road.distanceMeters !== null ? Math.round(road.distanceMeters).toString() : '—';
  const ttc = road.ttcSeconds !== null ? road.ttcSeconds.toFixed(1) : '—';
  const lead = road.leadSpeedKmh !== null ? Math.round(road.leadSpeedKmh).toString() : '—';

  const subtitle =
    road.reason === 'HARD_BRAKING' ? 'The vehicle ahead is slowing down fast'
    : road.reason === 'CROSSING' ? 'Something is crossing into your path'
    : road.reason === 'TAILGATING'
      ? `Gap ${road.headwaySeconds !== null ? road.headwaySeconds.toFixed(1) : '—'} s · keep at least ${p.gapLimitSeconds.toFixed(1)} s`
    : 'You are closing in on the vehicle ahead';

  // lane departure only shows when there is no collision-type warning (that one matters more)
  const drifting = p.departure === 'DRIFT_LEFT' || p.departure === 'DRIFT_RIGHT';
  const showDeparture = drifting && !warning;

  return (
    <>
      {/* top bar */}
      <View style={[styles.topBar, { top: p.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={p.onClose} style={styles.roundBtn} hitSlop={8}>
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>

        <Pressable onLongPress={p.onToggleDetails} style={styles.pill}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={styles.pillText}>{status}</Text>
        </Pressable>

        <View style={styles.speedPill}>
          <Text style={styles.speedValue}>{p.ownKmh !== null ? Math.round(p.ownKmh) : '—'}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      </View>

      {/* warning card */}
      {warning && (
        <Animated.View
          collapsable={false}
          pointerEvents="none"
          style={[styles.warning, { top: p.top + 70, backgroundColor: color, opacity: pulse }]}
        >
          <Text style={styles.warnIcon}>⚠</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.warnTitle}>{road.message || 'COLLISION WARNING'}</Text>
            <Text style={styles.warnSub}>{subtitle}</Text>
          </View>
        </Animated.View>
      )}

      {showDeparture && (
        <View collapsable={false} pointerEvents="none" style={[styles.warning, { top: p.top + 70, backgroundColor: AMBER }]}>
          <Text style={styles.warnIcon}>{p.departure === 'DRIFT_LEFT' ? '⬅' : '➡'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.warnTitle}>LANE DEPARTURE</Text>
            <Text style={styles.warnSub}>Drifting {p.departure === 'DRIFT_LEFT' ? 'left' : 'right'} · steer back</Text>
          </View>
        </View>
      )}

      {/* mount hint */}
      {p.mountMessage && (
        <View pointerEvents="none" style={[styles.hint, { bottom: p.bottom + 150 }]}>
          <Text style={styles.hintText}>📱 {p.mountMessage}</Text>
        </View>
      )}

      {/* bottom panel */}
      <View style={[styles.panel, { bottom: p.bottom + 12 }]}>
        <View style={styles.tiles}>
          <Tile label="AHEAD" value={dist} unit={dist === '—' ? undefined : 'm'} color={road.distanceMeters !== null ? color : '#e2e8f0'} />
          <View style={styles.divider} />
          <Tile label="COLLISION IN" value={ttc} unit={ttc === '—' ? undefined : 's'} color={road.ttcSeconds !== null ? color : '#e2e8f0'} />
          <View style={styles.divider} />
          <Tile label="CAR AHEAD" value={lead} unit={lead === '—' ? undefined : 'km/h'} color="#e2e8f0" />
        </View>

        <View style={styles.chips}>
          <View style={styles.chip}>
            <View style={[styles.chipDot, { backgroundColor: p.laneFound ? GREEN : '#64748b' }]} />
            <Text style={styles.chipText}>{p.laneFound ? 'Lane found' : 'No lane'}</Text>
          </View>
          {p.visibility !== 'normal' && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{p.visibility === 'night' ? '🌙 Night mode' : '🌫 Low visibility'}</Text>
            </View>
          )}
          {p.eco && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>🔋 Eco (phone hot)</Text>
            </View>
          )}
          {road.headwaySeconds !== null && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>Gap {road.headwaySeconds.toFixed(1)} s</Text>
            </View>
          )}
          <Pressable onPress={p.onCycleSpeed} style={styles.chip}>
            <Text style={styles.chipText}>Speed: {p.speedSource}  ›</Text>
          </Pressable>
        </View>

        {p.showDetails && <Text style={styles.details}>{p.details}</Text>}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: GLASS, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { color: 'white', fontSize: 18, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: GLASS, paddingHorizontal: 16, height: 40, borderRadius: 20 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  pillText: { color: 'white', fontSize: 15, fontWeight: '700' },
  speedPill: { minWidth: 62, height: 44, borderRadius: 22, backgroundColor: GLASS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  speedValue: { color: 'white', fontSize: 17, fontWeight: '800', lineHeight: 19 },
  speedUnit: { color: '#94a3b8', fontSize: 10, fontWeight: '600', lineHeight: 11 },

  warning: { position: 'absolute', left: 14, right: 14, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  warnIcon: { color: 'white', fontSize: 30, marginRight: 12 },
  warnTitle: { color: 'white', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  warnSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },

  hint: { position: 'absolute', left: 16, right: 16, backgroundColor: 'rgba(14,116,144,0.94)', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
  hintText: { color: 'white', fontSize: 13.5, fontWeight: '600', textAlign: 'center' },

  panel: { position: 'absolute', left: 12, right: 12, backgroundColor: GLASS, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 12 },
  tiles: { flexDirection: 'row', alignItems: 'center' },
  tile: { flex: 1, alignItems: 'center' },
  tileLabel: { color: '#94a3b8', fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8 },
  tileValue: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  tileUnit: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  divider: { width: StyleSheet.hairlineWidth, height: 38, backgroundColor: 'rgba(148,163,184,0.4)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(148,163,184,0.18)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginHorizontal: 4, marginBottom: 6 },
  chipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  chipText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  details: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 10 },
});