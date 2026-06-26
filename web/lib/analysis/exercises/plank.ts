// Plank rule engine — a timed hold, not reps. Capture from the SIDE.
import { LM } from '../../pose/landmarks';
import { mean, stdev } from '../math';
import { makeIssue } from '../scoring';
import type { ExerciseModule, FrameSample, Issue } from '../types';
import { bodyLine, side } from './helpers';

const SAG_LINE = 165; // below this with hips low => sagging
const PIKE_LINE = 195; // (using >180 not possible; we detect pike via hip height)

export const plank: ExerciseModule = {
  name: 'plank',
  label: 'Plank',
  requiredCameraAngle: 'side',
  isHold: true,
  trackedJoints: [
    LM.LEFT_SHOULDER,
    LM.RIGHT_SHOULDER,
    LM.LEFT_HIP,
    LM.RIGHT_HIP,
    LM.LEFT_KNEE,
    LM.RIGHT_KNEE,
    LM.LEFT_ANKLE,
    LM.RIGHT_ANKLE,
  ],
  repSignal: () => null,
  topBand: [0, 0],
  bottomBand: [0, 0],
  minAmplitude: 0,
  minDuration: 0,
  bottomDirection: 'down',
  analyzeRep() {},
  analyzeSet(_reps, samples) {
    return analyzePlankHold(samples);
  },
};

/** Plank is scored over the whole clip; we expose hold seconds + line stability. */
export function analyzePlankHold(samples: FrameSample[]): Issue[] {
  const issues: Issue[] = [];
  const good = samples.filter((s) => s.quality >= 0.5);
  if (good.length < 5) return issues;

  const lines = good.map((s) => bodyLine(s.lm)).filter(Number.isFinite);
  const avgLine = mean(lines);

  // Sag: hips lower than the shoulder-knee line.
  const sagFrames = good.filter((s) => {
    const sd = side(s.lm, LM.LEFT_HIP, LM.RIGHT_HIP);
    const hip = sd === 'left' ? s.lm[LM.LEFT_HIP] : s.lm[LM.RIGHT_HIP];
    const sh = sd === 'left' ? s.lm[LM.LEFT_SHOULDER] : s.lm[LM.RIGHT_SHOULDER];
    return bodyLine(s.lm) < SAG_LINE && hip.y > sh.y;
  });
  if (sagFrames.length > good.length * 0.25) {
    issues.push(
      makeIssue({
        name: 'Hips sagging',
        severity: 'major',
        affectedReps: [],
        why: 'Dropping the hips arches and stresses the lower back instead of bracing the core.',
        fix: 'Squeeze glutes and abs to hold a straight line from shoulders to heels.',
      })
    );
  }

  // Drift over time: line worsens toward the end (fatigue).
  const firstHalf = mean(lines.slice(0, Math.floor(lines.length / 2)));
  const secondHalf = mean(lines.slice(Math.floor(lines.length / 2)));
  if (Number.isFinite(firstHalf) && Number.isFinite(secondHalf) && firstHalf - secondHalf > 8) {
    issues.push(
      makeIssue({
        name: 'Form breaking down over time',
        severity: 'minor',
        affectedReps: [],
        why: 'Your line dropped as the hold went on — a sign of fatigue.',
        fix: 'End the hold when your hips start to sag; quality beats duration.',
      })
    );
  }

  if (stdev(lines) > 10) {
    issues.push(
      makeIssue({
        name: 'Unstable hold',
        severity: 'minor',
        affectedReps: [],
        why: 'Your body position is wobbling rather than held steady.',
        fix: 'Brace hard and fix your gaze on the floor to stay still.',
      })
    );
  }
  return issues;
}
