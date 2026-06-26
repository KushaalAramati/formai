// Push-up rule engine. Capture from the SIDE.
import { LM } from '../../pose/landmarks';
import { stdev } from '../math';
import { makeIssue, scoreRep } from '../scoring';
import type { ExerciseModule, Issue, Rep } from '../types';
import { bodyLine, elbowAngleBest, repMean, tempo, side } from './helpers';

const ELBOW_DEPTH = 100; // bottom elbow angle <= this => good depth
const ELBOW_PARTIAL = 120;
const SAG_LINE = 162; // body-line angle < this (and hips low) => hip sag
const PIKE_LINE = 162; // body-line bent the other way => piking

export const pushup: ExerciseModule = {
  name: 'pushup',
  label: 'Push-up',
  requiredCameraAngle: 'side',
  trackedJoints: [
    LM.LEFT_SHOULDER,
    LM.RIGHT_SHOULDER,
    LM.LEFT_ELBOW,
    LM.RIGHT_ELBOW,
    LM.LEFT_WRIST,
    LM.RIGHT_WRIST,
    LM.LEFT_HIP,
    LM.RIGHT_HIP,
    LM.LEFT_KNEE,
    LM.RIGHT_KNEE,
  ],
  repSignal: (s) => {
    const a = elbowAngleBest(s.lm);
    return Number.isFinite(a) ? a : null;
  },
  topBand: [160, 155], // arms extended
  // Count partial push-ups too (below ~135° elbow); the ROM rules judge depth.
  bottomBand: [130, 135],
  minAmplitude: 30,
  minDuration: 0.5,
  bottomDirection: 'down', // elbow angle drops at the bottom

  analyzeRep(rep) {
    const bottom = extreme(rep, (lm) => elbowAngleBest(lm), 'min');
    const minElbow = elbowAngleBest(bottom.lm);
    rep.angles.bottomElbow = Math.round(minElbow);
    const avgLine = repMean(rep, bodyLine);
    rep.angles.bodyLine = Math.round(avgLine);

    // Depth / ROM
    if (minElbow > ELBOW_PARTIAL) {
      rep.issues.push(
        makeIssue({
          name: 'Incomplete range of motion',
          severity: 'major',
          affectedReps: [rep.repNumber],
          why: 'Not lowering far enough shortens the rep and reduces chest/triceps work.',
          fix: 'Lower until your elbows reach about 90°, chest near the floor. Drop to knees if needed to reach depth.',
          overBy: (minElbow - ELBOW_DEPTH) / 30,
        })
      );
    } else if (minElbow > ELBOW_DEPTH) {
      rep.issues.push(
        makeIssue({
          name: 'Slightly short depth',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Close, but a little more depth gives full range.',
          fix: 'Lower a touch more until elbows reach ~90°.',
        })
      );
    }

    // Hip sag vs pike: bodyLine is the shoulder-hip-knee angle (~180 straight).
    const hips = bottom.lm[side(bottom.lm, LM.LEFT_HIP, LM.RIGHT_HIP) === 'left' ? LM.LEFT_HIP : LM.RIGHT_HIP];
    const sh = bottom.lm[side(bottom.lm, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER) === 'left' ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER];
    if (avgLine < SAG_LINE && hips.y > sh.y) {
      rep.issues.push(
        makeIssue({
          name: 'Hips sagging',
          severity: 'major',
          affectedReps: [rep.repNumber],
          why: 'Letting the hips drop arches the lower back and takes the core out of the movement.',
          fix: 'Squeeze your glutes and brace your abs so your body is one straight line.',
          overBy: (SAG_LINE - avgLine) / 20,
        })
      );
    } else if (avgLine < PIKE_LINE) {
      rep.issues.push(
        makeIssue({
          name: 'Hips piking up',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Raising the hips makes the push-up easier and shortens the range.',
          fix: 'Lower your hips so your body forms a straight line from shoulders to knees/heels.',
        })
      );
    }

    // Head/neck: ear should stay roughly in line, not dropped far below shoulder.
    const ear = bottom.lm[side(bottom.lm, LM.LEFT_EAR, LM.RIGHT_EAR) === 'left' ? LM.LEFT_EAR : LM.RIGHT_EAR];
    if (ear && ear.visibility > 0.4 && ear.y > sh.y + 0.06) {
      rep.issues.push(
        makeIssue({
          name: 'Head dropping',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Letting the head hang strains the neck.',
          fix: 'Keep a neutral neck — look at the floor slightly ahead of your hands.',
        })
      );
    }

    scoreRep(rep);
  },

  analyzeSet(reps) {
    const issues: Issue[] = [];
    const depths = reps.map((r) => r.angles.bottomElbow).filter(Number.isFinite);
    if (depths.length >= 3 && stdev(depths) > 14) {
      issues.push(
        makeIssue({
          name: 'Inconsistent depth',
          severity: 'minor',
          affectedReps: [],
          why: 'Depth drifts across the set — often a sign of fatigue.',
          fix: 'Stop the set when you can no longer reach full depth with good form.',
        })
      );
    }
    const cons = reps.map((r) => tempo(r, (s) => elbowAngleBest(s.lm), 'down').concentric);
    if (cons.filter((x) => x > 0 && x < 0.3).length > reps.length / 2) {
      issues.push(
        makeIssue({
          name: 'Rushing the press',
          severity: 'minor',
          affectedReps: [],
          why: 'Pressing up very fast usually means bouncing rather than controlling the rep.',
          fix: 'Control the lowering (~2s down) and press up smoothly without bouncing.',
        })
      );
    }
    return issues;
  },
};

function extreme(rep: Rep, f: (lm: any) => number, kind: 'min' | 'max') {
  let best = rep.samples[0];
  let val = kind === 'min' ? Infinity : -Infinity;
  for (const s of rep.samples) {
    const a = f(s.lm);
    if (!Number.isFinite(a)) continue;
    if ((kind === 'min' && a < val) || (kind === 'max' && a > val)) {
      val = a;
      best = s;
    }
  }
  return best;
}
