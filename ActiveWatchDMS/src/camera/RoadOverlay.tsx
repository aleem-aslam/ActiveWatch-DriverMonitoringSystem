// src/camera/RoadOverlay.tsx
// Boxes around tracked road users (name, distance, speed), a TTC chip, and a warning banner.
// Draws over a full-screen preview that uses resizeMode "cover".
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ROAD_CLASSES } from '../ml/collision/yoloDecoder';
import type { RoadDetections } from '../ml/collision/useRoadMonitor';
import type { CollisionSnapshot } from '../ml/collision/ttcEstimator';
import type { LaneResult } from '../ml/collision/laneDetector';

const SAFE_SNAPSHOT: CollisionSnapshot = {
  level: 'SAFE', ttcSeconds: null, distanceMeters: null, target: null,
  reason: 'NONE', message: '', leadSpeedKmh: null, youBraking: false, headwaySeconds: null, tracks: [],
};

export default function RoadOverlay({
  dets = { list: [], w: 1, h: 1 },
  road = SAFE_SNAPSHOT,
  view = { w: 0, h: 0 },
  lane = null,
  showHud = true,
}: {
  dets?: RoadDetections;
  road?: CollisionSnapshot;
  view?: { w: number; h: number };
  lane?: LaneResult | null;
  /** false = the screen draws its own TTC chip and warning banner (RoadHud) */
  showHud?: boolean;
}) {
  const boxes = useMemo(() => {
    if (view.w === 0 || view.h === 0) return [];
    const scale = Math.max(view.w / dets.w, view.h / dets.h);
    const dw = dets.w * scale;
    const dh = dets.h * scale;
    const ox = (view.w - dw) / 2;
    const oy = (view.h - dh) / 2;
    return (road.tracks ?? []).map((tr) => {
      const d = tr.det;
      const name = ROAD_CLASSES[d.classId] ?? String(d.classId);
      // clamp to the visible area so labels at the screen edge are not cut off
      const l = Math.max(0, d.x0 * dw + ox);
      const t = Math.max(0, d.y0 * dh + oy);
      const r = Math.min(view.w, d.x1 * dw + ox);
      const b = Math.min(view.h, d.y1 * dh + oy);
      const parts = [name];
      if (tr.distanceM !== null) parts.push(`~${tr.distanceM.toFixed(0)} m`);
      if (tr.speedKmh !== null) parts.push(`${tr.speedKmh.toFixed(0)} km/h`);
      return {
        key: tr.id,
        left: l,
        top: t,
        width: Math.max(0, r - l),
        height: Math.max(0, b - t),
        label: parts.join(' · '),
        risk: tr.risk,
        isTarget: road.target === d,
      };
    });
  }, [dets, road, view]);

  // lane lines (same "cover" mapping as the boxes)
  const laneSegs = useMemo(() => {
    if (!lane || view.w === 0 || view.h === 0) return [];
    const scale = Math.max(view.w / dets.w, view.h / dets.h);
    const dw = dets.w * scale;
    const dh = dets.h * scale;
    const ox = (view.w - dw) / 2;
    const oy = (view.h - dh) / 2;
    return [lane.left, lane.right].map((l) => ({
      x0: l.x0 * dw + ox, y0: l.y0 * dh + oy, x1: l.x1 * dw + ox, y1: l.y1 * dh + oy,
    }));
  }, [lane, dets.w, dets.h, view]);

  const collision = road.level === 'COLLISION';
  const caution = road.level === 'CAUTION' && road.reason !== 'NONE';
  const hasTtc = road.ttcSeconds !== null;

  return (
    <>
      {laneSegs.map((sg, i) => {
        const dx = sg.x1 - sg.x0;
        const dy = sg.y1 - sg.y0;
        const len = Math.hypot(dx, dy);
        return (
          <View
            key={`lane${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: (sg.x0 + sg.x1) / 2 - len / 2,
              top: (sg.y0 + sg.y1) / 2 - 1.5,
              width: len,
              height: 3,
              backgroundColor: 'rgba(56,189,248,0.75)',
              transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
            }}
          />
        );
      })}

      {boxes.map((b) => {
        const color =
          b.risk === 'COLLISION' ? '#ef4444'
          : b.risk === 'CAUTION' ? '#f59e0b'
          : b.isTarget ? '#22c55e'
          : 'rgba(255,255,255,0.45)';
        return (
          <View
            key={b.key}
            pointerEvents="none"
            style={[styles.box, { left: b.left, top: b.top, width: b.width, height: b.height, borderColor: color }]}
          >
            <Text style={styles.label} numberOfLines={1}>{b.label}</Text>
          </View>
        );
      })}

      {showHud && hasTtc && (
        <View pointerEvents="none" style={styles.chip}>
          <Text style={styles.chipText}>
            TTC {road.ttcSeconds!.toFixed(1)} s
            {road.distanceMeters !== null ? `  ·  ~${road.distanceMeters.toFixed(0)} m` : ''}
          </Text>
        </View>
      )}

      {showHud && (collision || caution) && (
        <View
          pointerEvents="none"
          style={[styles.banner, { backgroundColor: collision ? 'rgba(239,68,68,0.92)' : 'rgba(245,158,11,0.92)' }]}
        >
          <Text style={styles.bannerIcon}>⚠</Text>
          <Text style={styles.bannerText}>{road.message || 'COLLISION WARNING'}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', borderWidth: 3, borderRadius: 8 },
  label: { color: 'white', fontSize: 12, fontWeight: '600', maxWidth: '100%', backgroundColor: 'rgba(0,0,0,0.55)', alignSelf: 'flex-start', paddingHorizontal: 4 },
  chip: {
    position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
  },
  chipText: { color: 'white', fontSize: 15, fontWeight: '600' },
  banner: {
    position: 'absolute', top: 110, left: 20, right: 20, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  bannerIcon: { color: 'white', fontSize: 28, marginRight: 10 },
  bannerText: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5, flexShrink: 1 },
});