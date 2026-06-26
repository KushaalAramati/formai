// Pure geometry/statistics helpers. No DOM, no MediaPipe — unit-testable in node.
import type { Landmark } from './types';

export interface V2 {
  x: number;
  y: number;
}

export const v = (p: Landmark | V2): V2 => ({ x: p.x, y: p.y });

export function sub(a: V2, b: V2): V2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function len(a: V2): number {
  return Math.hypot(a.x, a.y);
}

/**
 * Interior angle at vertex `b` formed by points a-b-c, in degrees [0,180].
 * Used for knee/elbow/hip angles.
 */
export function angleAt(a: V2, b: V2, c: V2): number {
  const ab = sub(a, b);
  const cb = sub(c, b);
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = len(ab) * len(cb);
  if (mag < 1e-9) return NaN;
  const cos = clamp(dot / mag, -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Angle of segment a->b away from vertical (0 = perfectly vertical), degrees [0,180].
 * Image Y grows downward; we measure tilt magnitude. Used for torso lean.
 */
export function tiltFromVertical(a: V2, b: V2): number {
  const d = sub(b, a);
  // vertical reference vector (0,1). angle between d and vertical.
  const mag = len(d);
  if (mag < 1e-9) return NaN;
  const cos = clamp(Math.abs(d.y) / mag, 0, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function mean(xs: number[]): number {
  if (!xs.length) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function midpoint(a: V2, b: V2): V2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Simple moving-average smoothing of a numeric series (window odd). */
export function smooth(xs: number[], window = 5): number[] {
  if (window <= 1) return xs.slice();
  const half = Math.floor(window / 2);
  return xs.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < xs.length && !Number.isNaN(xs[j])) {
        s += xs[j];
        n++;
      }
    }
    return n ? s / n : xs[i];
  });
}
