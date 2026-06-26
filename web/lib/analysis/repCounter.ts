// Generic rep counter: two-threshold hysteresis on a single scalar "rep signal",
// plus amplitude + duration gates to reject jitter and partial bounces.
// Works for any exercise that exposes a rep signal.
import type { ExerciseModule, FrameSample, Rep } from './types';
import { smooth } from './math';

/**
 * Segment frames into reps.
 * bottomDirection 'down': signal DROPS to reach the bottom of the movement (squat knee angle,
 *   push-up/curl elbow angle). bottomDirection 'up': signal RISES at the bottom of the movement
 *   (lateral raise abduction). We normalize so "bottom" is always a LOW value, then count a rep
 *   as: signal falls below `low`, then rises back above `high`.
 */
export function countReps(ex: ExerciseModule, samples: FrameSample[]): Rep[] {
  if (ex.isHold) return [];

  const idx: number[] = [];
  const raw: number[] = [];
  samples.forEach((s, i) => {
    const v = ex.repSignal(s);
    if (v != null && Number.isFinite(v) && s.quality >= 0.4) {
      idx.push(i);
      raw.push(ex.bottomDirection === 'up' ? -v : v); // normalize: bottom = low value
    }
  });
  if (raw.length < 6) return [];

  const sig = smooth(raw, 3);

  // Normalize the bands the same way, then derive hysteresis thresholds.
  const tb = ex.bottomDirection === 'up' ? ex.topBand.map((x) => -x) : ex.topBand;
  const bb = ex.bottomDirection === 'up' ? ex.bottomBand.map((x) => -x) : ex.bottomBand;
  // After normalization top = HIGH value, bottom = LOW value.
  const highThresh = Math.min(tb[0], tb[1]); // rise above this => back at top (rep complete)
  const lowThresh = Math.max(bb[0], bb[1]); // fall below this => reached the bottom

  type State = 'TOP' | 'DOWN';
  let state: State = 'TOP';
  let startK = 0;
  // Track the true peak while at the top so rep amplitude is measured from the real top,
  // not from the last frame above threshold (which is already part-way down).
  let peakVal = sig[0];
  let peakK = 0;
  const rawReps: { startIdx: number; endIdx: number }[] = [];

  for (let k = 0; k < sig.length; k++) {
    const x = sig[k];
    if (state === 'TOP') {
      if (x > peakVal) {
        peakVal = x;
        peakK = k;
      }
      if (x < lowThresh) {
        state = 'DOWN';
        startK = peakK; // rep started at the top peak
      }
    } else {
      if (x >= highThresh) {
        rawReps.push({ startIdx: idx[startK], endIdx: idx[k] });
        state = 'TOP';
        peakVal = x;
        peakK = k;
      }
    }
  }

  // Apply amplitude + duration gates.
  const reps: Rep[] = [];
  for (const rr of rawReps) {
    const slice = samples.slice(rr.startIdx, rr.endIdx + 1);
    const startT = samples[rr.startIdx].t;
    const endT = samples[rr.endIdx].t;
    const vals = slice
      .map((s) => ex.repSignal(s))
      .filter((x): x is number => x != null && Number.isFinite(x));
    if (vals.length < 3) continue;
    const amplitude = Math.max(...vals) - Math.min(...vals);
    const duration = endT - startT;
    if (amplitude < ex.minAmplitude) continue; // partial bounce
    if (duration < ex.minDuration) continue; // too fast
    reps.push({
      repNumber: reps.length + 1,
      startT,
      endT,
      samples: slice,
      angles: {},
      issues: [],
      score: 100,
      label: 'good',
      keyFrameIndex: 0,
    });
  }
  return reps;
}
