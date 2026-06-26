// Shoulder press rule engine. Capture from the FRONT (flare, symmetry) or side (lockout, lean).
import { LM } from '../../pose/landmarks';
import { makeIssue, scoreRep } from '../scoring';
import type { ExerciseModule, Issue } from '../types';
import { elbowAngle, elbowAngleBest, side, torsoLean } from './helpers';

const LOCKOUT = 160; // top elbow angle >= this => full lockout
const BOTTOM = 95; // bottom elbow angle <= this => full depth at shoulders
const LEAN_MAX = 18; // torso lean from vertical above this => leaning back
const SYM_DIFF = 18; // L/R elbow angle diff at top

export const shoulderPress: ExerciseModule = {
  name: 'shoulderPress',
  label: 'Shoulder Press',
  requiredCameraAngle: 'front',
  trackedJoints: [
    LM.LEFT_SHOULDER,
    LM.RIGHT_SHOULDER,
    LM.LEFT_ELBOW,
    LM.RIGHT_ELBOW,
    LM.LEFT_WRIST,
    LM.RIGHT_WRIST,
    LM.LEFT_HIP,
    LM.RIGHT_HIP,
  ],
  repSignal: (s) => {
    const a = elbowAngleBest(s.lm);
    return Number.isFinite(a) ? a : null;
  },
  // top of movement (overhead) = arms straight = high elbow angle.
  // We treat "bottom" of the FSM as the racked position (low elbow angle).
  topBand: [165, 158], // locked out overhead
  bottomBand: [95, 105], // racked at shoulders
  minAmplitude: 45,
  minDuration: 0.5,
  bottomDirection: 'down',

  analyzeRep(rep) {
    const s = side(rep.samples[Math.floor(rep.samples.length / 2)].lm, LM.LEFT_ELBOW, LM.RIGHT_ELBOW);
    const angles = rep.samples.filter((f) => f.quality >= 0.4).map((f) => elbowAngle(f.lm, s));
    const top = Math.max(...angles.filter(Number.isFinite));
    const bottom = Math.min(...angles.filter(Number.isFinite));
    rep.angles.lockout = Math.round(top);
    rep.angles.bottom = Math.round(bottom);

    if (top < LOCKOUT) {
      rep.issues.push(
        makeIssue({
          name: 'Not locking out overhead',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Stopping short of full extension misses the top of the press.',
          fix: 'Press all the way until your arms are straight overhead.',
          overBy: (LOCKOUT - top) / 25,
        })
      );
    }
    if (bottom > BOTTOM + 15) {
      rep.issues.push(
        makeIssue({
          name: 'Short range at the bottom',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Not lowering to shoulder level shortens the rep.',
          fix: 'Lower the weight to about ear/shoulder height each rep.',
        })
      );
    }
    const lean = Math.max(...rep.samples.filter((f) => f.quality >= 0.4).map((f) => torsoLean(f.lm)));
    if (lean > LEAN_MAX) {
      rep.issues.push(
        makeIssue({
          name: 'Leaning back',
          severity: 'major',
          affectedReps: [rep.repNumber],
          why: 'Leaning back turns the press into an incline press and stresses the lower back.',
          fix: 'Brace your abs and squeeze your glutes so your torso stays upright. Lower the weight if needed.',
          overBy: (lean - LEAN_MAX) / 15,
        })
      );
    }
    scoreRep(rep);
  },

  analyzeSet(reps): Issue[] {
    const issues: Issue[] = [];
    let asym = 0;
    for (const r of reps) {
      const lt = Math.max(...r.samples.map((f) => elbowAngle(f.lm, 'left')).filter(Number.isFinite));
      const rt = Math.max(...r.samples.map((f) => elbowAngle(f.lm, 'right')).filter(Number.isFinite));
      if (Number.isFinite(lt) && Number.isFinite(rt) && Math.abs(lt - rt) > SYM_DIFF) asym++;
    }
    if (asym > reps.length / 3) {
      issues.push(
        makeIssue({
          name: 'Uneven press (left/right)',
          severity: 'minor',
          affectedReps: [],
          why: 'One arm is locking out more than the other.',
          fix: 'Press both arms evenly; the weaker side may be limiting you. Try single-arm pressing.',
        })
      );
    }
    return issues;
  },
};
