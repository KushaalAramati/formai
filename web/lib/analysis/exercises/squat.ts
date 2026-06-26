// Squat rule engine. Best captured from the SIDE (depth, torso) — front view also helps knee cave.
import { LM } from '../../pose/landmarks';
import { mean, stdev } from '../math';
import { makeIssue, scoreRep } from '../scoring';
import type { ExerciseModule, Issue, Rep } from '../types';
import {
  kneeAngle,
  kneeAngleBoth,
  torsoLean,
  tempo,
  repMean,
  side,
} from './helpers';

// Tunable thresholds (degrees / normalized units). Documented inline.
const DEPTH_GOOD = 95; // knee angle at bottom <= this => good depth (parallel-ish)
const DEPTH_PARTIAL = 120; // > this at bottom => clearly partial
const TORSO_LEAN_MAX = 45; // torso tilt from vertical beyond this => excessive lean
const VALGUS_RATIO = 0.85; // knee-x gap / ankle-x gap below this => knees caving (front view)
const IMBALANCE_DEG = 15; // L/R knee angle difference at bottom

export const squat: ExerciseModule = {
  name: 'squat',
  label: 'Squat',
  requiredCameraAngle: 'side',
  trackedJoints: [
    LM.LEFT_HIP,
    LM.RIGHT_HIP,
    LM.LEFT_KNEE,
    LM.RIGHT_KNEE,
    LM.LEFT_ANKLE,
    LM.RIGHT_ANKLE,
    LM.LEFT_SHOULDER,
    LM.RIGHT_SHOULDER,
  ],
  repSignal: (s) => {
    const a = kneeAngle(s.lm);
    return Number.isFinite(a) ? a : null;
  },
  topBand: [165, 160], // standing: knee ~ straight
  // Count any rep with real knee bend (below ~145°); the depth rules below judge how deep.
  bottomBand: [140, 145],
  minAmplitude: 35, // knees must bend at least this much to count
  minDuration: 0.5,
  bottomDirection: 'down', // knee angle DROPS at the bottom

  analyzeRep(rep) {
    const bottom = bottomSample(rep);
    const both = kneeAngleBoth(bottom.lm);
    const minKnee = Math.min(both.left, both.right);
    rep.angles.bottomKnee = Math.round(minKnee);
    rep.angles.torsoLean = Math.round(repMaxTorso(rep));

    // 1. Depth
    if (minKnee > DEPTH_PARTIAL) {
      rep.issues.push(
        makeIssue({
          name: 'Shallow depth',
          severity: 'major',
          affectedReps: [rep.repNumber],
          why: 'Stopping high cuts the working range and trains less muscle.',
          fix: 'Sit down until your thighs reach about parallel to the floor (knees bent ~90°).',
          overBy: (minKnee - DEPTH_GOOD) / 25,
        })
      );
    } else if (minKnee > DEPTH_GOOD) {
      rep.issues.push(
        makeIssue({
          name: 'Slightly above parallel',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'You are close, but a touch more depth gives full range.',
          fix: 'Aim to sink another few centimeters so thighs reach parallel.',
        })
      );
    }

    // 2. Torso lean
    const lean = repMaxTorso(rep);
    if (lean > TORSO_LEAN_MAX) {
      rep.issues.push(
        makeIssue({
          name: 'Excessive forward lean',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'A big forward lean shifts load to your lower back.',
          fix: 'Keep your chest up and weight mid-foot. Try a slightly wider stance or counterbalance.',
          overBy: (lean - TORSO_LEAN_MAX) / 25,
        })
      );
    }

    // 3. Knee valgus (front view): horizontal knee gap collapses vs ankle gap.
    const kneeGap = Math.abs(bottom.lm[LM.LEFT_KNEE].x - bottom.lm[LM.RIGHT_KNEE].x);
    const ankleGap = Math.abs(bottom.lm[LM.LEFT_ANKLE].x - bottom.lm[LM.RIGHT_ANKLE].x);
    if (ankleGap > 0.04 && kneeGap / ankleGap < VALGUS_RATIO) {
      rep.issues.push(
        makeIssue({
          name: 'Knees caving inward',
          severity: 'major',
          affectedReps: [rep.repNumber],
          why: 'Knees collapsing inward (valgus) stresses the knee joint.',
          fix: 'Actively push your knees out in line with your toes. Strengthen glutes; consider lighter weight.',
          overBy: (VALGUS_RATIO - kneeGap / ankleGap) / 0.3,
        })
      );
    }

    // 4. Heel lift: heel rises relative to foot/ankle at the bottom.
    const s = side(bottom.lm, LM.LEFT_HEEL, LM.RIGHT_HEEL);
    const heel = s === 'left' ? bottom.lm[LM.LEFT_HEEL] : bottom.lm[LM.RIGHT_HEEL];
    const foot = s === 'left' ? bottom.lm[LM.LEFT_FOOT] : bottom.lm[LM.RIGHT_FOOT];
    if (heel && foot && heel.visibility > 0.5 && heel.y < foot.y - 0.03) {
      rep.issues.push(
        makeIssue({
          name: 'Heels lifting',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Rising onto your toes reduces stability and pushes you forward.',
          fix: 'Keep heels planted; drive through mid-foot. Elevating heels slightly (shoes/plate) can help ankle mobility.',
        })
      );
    }

    // 5. Left/right imbalance within the rep
    if (
      Number.isFinite(both.left) &&
      Number.isFinite(both.right) &&
      Math.abs(both.left - both.right) > IMBALANCE_DEG
    ) {
      rep.issues.push(
        makeIssue({
          name: 'Left/right imbalance',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'One leg is bending noticeably more than the other.',
          fix: 'Keep weight even across both feet. Single-leg work can even out the difference.',
        })
      );
    }

    scoreRep(rep);
  },

  analyzeSet(reps) {
    return setLevelSquat(reps);
  },
};

function bottomSample(rep: Rep) {
  let b = rep.samples[0];
  let min = Infinity;
  for (const s of rep.samples) {
    const a = kneeAngle(s.lm);
    if (Number.isFinite(a) && a < min) {
      min = a;
      b = s;
    }
  }
  return b;
}

function repMaxTorso(rep: Rep): number {
  return Math.max(
    ...rep.samples.filter((s) => s.quality >= 0.4).map((s) => torsoLean(s.lm)).filter(Number.isFinite)
  );
}

/** Cross-rep checks: tempo + depth consistency. Exported pattern reused by other modules. */
export function setLevelSquat(reps: Rep[]): Issue[] {
  const issues: Issue[] = [];
  if (reps.length < 2) return issues;

  const depths = reps.map((r) => r.angles.bottomKnee).filter(Number.isFinite);
  if (depths.length >= 3 && stdev(depths) > 14) {
    issues.push(
      makeIssue({
        name: 'Inconsistent depth',
        severity: 'minor',
        affectedReps: [],
        why: 'Your squat depth varies a lot rep to rep, which makes the set harder to judge and progress.',
        fix: 'Pick one depth target and hit it every rep. Filming from the side helps you self-check.',
      })
    );
  }

  const concentrics = reps.map((r) => tempo(r, (s) => kneeAngle(s.lm), 'down').concentric);
  const avgCon = mean(concentrics.filter((x) => x > 0));
  if (avgCon > 0 && avgCon < 0.4) {
    issues.push(
      makeIssue({
        name: 'Bouncing out of the bottom',
        severity: 'minor',
        affectedReps: [],
        why: 'Standing up very fast often means using momentum instead of control.',
        fix: 'Pause briefly at the bottom and drive up under control (about 1 second up).',
      })
    );
  }
  return issues;
}
