// Pose-derived measurements reused across exercise modules.
import { LM } from '../../pose/landmarks';
import { angleAt, mean, midpoint, sub, tiltFromVertical, v } from '../math';
import type { FrameSample, Landmark, Rep } from '../types';

export const side = (lm: Landmark[], left: number, right: number): 'left' | 'right' =>
  (lm[left]?.visibility ?? 0) >= (lm[right]?.visibility ?? 0) ? 'left' : 'right';

/** Knee angle (hip-knee-ankle). Pick the more visible leg. */
export function kneeAngle(lm: Landmark[]): number {
  const s = side(lm, LM.LEFT_KNEE, LM.RIGHT_KNEE);
  if (s === 'left') return angleAt(v(lm[LM.LEFT_HIP]), v(lm[LM.LEFT_KNEE]), v(lm[LM.LEFT_ANKLE]));
  return angleAt(v(lm[LM.RIGHT_HIP]), v(lm[LM.RIGHT_KNEE]), v(lm[LM.RIGHT_ANKLE]));
}

export function kneeAngleBoth(lm: Landmark[]): { left: number; right: number } {
  return {
    left: angleAt(v(lm[LM.LEFT_HIP]), v(lm[LM.LEFT_KNEE]), v(lm[LM.LEFT_ANKLE])),
    right: angleAt(v(lm[LM.RIGHT_HIP]), v(lm[LM.RIGHT_KNEE]), v(lm[LM.RIGHT_ANKLE])),
  };
}

/** Elbow angle (shoulder-elbow-wrist). */
export function elbowAngle(lm: Landmark[], s: 'left' | 'right'): number {
  if (s === 'left')
    return angleAt(v(lm[LM.LEFT_SHOULDER]), v(lm[LM.LEFT_ELBOW]), v(lm[LM.LEFT_WRIST]));
  return angleAt(v(lm[LM.RIGHT_SHOULDER]), v(lm[LM.RIGHT_ELBOW]), v(lm[LM.RIGHT_WRIST]));
}

export function elbowAngleBest(lm: Landmark[]): number {
  const s = side(lm, LM.LEFT_ELBOW, LM.RIGHT_ELBOW);
  return elbowAngle(lm, s);
}

/** Shoulder abduction proxy: angle hip-shoulder-elbow (arm raised from torso). */
export function shoulderAbduction(lm: Landmark[], s: 'left' | 'right'): number {
  if (s === 'left')
    return angleAt(v(lm[LM.LEFT_HIP]), v(lm[LM.LEFT_SHOULDER]), v(lm[LM.LEFT_ELBOW]));
  return angleAt(v(lm[LM.RIGHT_HIP]), v(lm[LM.RIGHT_SHOULDER]), v(lm[LM.RIGHT_ELBOW]));
}

/** Hip angle (shoulder-hip-knee) — torso/leg fold, used for hip hinge & sag. */
export function hipAngle(lm: Landmark[], s: 'left' | 'right'): number {
  if (s === 'left')
    return angleAt(v(lm[LM.LEFT_SHOULDER]), v(lm[LM.LEFT_HIP]), v(lm[LM.LEFT_KNEE]));
  return angleAt(v(lm[LM.RIGHT_SHOULDER]), v(lm[LM.RIGHT_HIP]), v(lm[LM.RIGHT_KNEE]));
}

/** Torso lean away from vertical (shoulder-mid to hip-mid). Degrees. */
export function torsoLean(lm: Landmark[]): number {
  const sh = midpoint(v(lm[LM.LEFT_SHOULDER]), v(lm[LM.RIGHT_SHOULDER]));
  const hp = midpoint(v(lm[LM.LEFT_HIP]), v(lm[LM.RIGHT_HIP]));
  return tiltFromVertical(hp, sh);
}

/** Body-line straightness for push-up/plank: angle shoulder-hip-knee (180 = straight). */
export function bodyLine(lm: Landmark[]): number {
  const s = side(lm, LM.LEFT_HIP, LM.RIGHT_HIP);
  if (s === 'left')
    return angleAt(v(lm[LM.LEFT_SHOULDER]), v(lm[LM.LEFT_HIP]), v(lm[LM.LEFT_KNEE]));
  return angleAt(v(lm[LM.RIGHT_SHOULDER]), v(lm[LM.RIGHT_HIP]), v(lm[LM.RIGHT_KNEE]));
}

/** Normalized shoulder width — used to scale horizontal drift measurements. */
export function shoulderWidth(lm: Landmark[]): number {
  return Math.hypot(
    lm[LM.LEFT_SHOULDER].x - lm[LM.RIGHT_SHOULDER].x,
    lm[LM.LEFT_SHOULDER].y - lm[LM.RIGHT_SHOULDER].y
  );
}

/** Concentric & eccentric durations from a rep, using its rep-signal trajectory. */
export function tempo(
  rep: Rep,
  signal: (s: FrameSample) => number | null,
  bottomDir: 'down' | 'up'
): { eccentric: number; concentric: number; total: number } {
  const pts = rep.samples
    .map((s) => ({ t: s.t, x: signal(s) }))
    .filter((p): p is { t: number; x: number } => p.x != null && Number.isFinite(p.x));
  if (pts.length < 3) return { eccentric: 0, concentric: 0, total: rep.endT - rep.startT };
  // bottom = extreme of movement
  let bIdx = 0;
  for (let i = 1; i < pts.length; i++) {
    const isMoreBottom = bottomDir === 'down' ? pts[i].x < pts[bIdx].x : pts[i].x > pts[bIdx].x;
    if (isMoreBottom) bIdx = i;
  }
  const eccentric = pts[bIdx].t - pts[0].t; // top -> bottom
  const concentric = pts[pts.length - 1].t - pts[bIdx].t; // bottom -> top
  return { eccentric, concentric, total: pts[pts.length - 1].t - pts[0].t };
}

/** Mean over a rep of a per-frame scalar. */
export function repMean(rep: Rep, f: (lm: Landmark[]) => number): number {
  return mean(
    rep.samples
      .filter((s) => s.quality >= 0.4)
      .map((s) => f(s.lm))
      .filter((x) => Number.isFinite(x))
  );
}

export { sub };
