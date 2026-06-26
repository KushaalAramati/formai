// Bicep curl rule engine. Capture from the SIDE (or 45°).
import { LM } from '../../pose/landmarks';
import { stdev } from '../math';
import { makeIssue, scoreRep } from '../scoring';
import type { ExerciseModule, Issue, Rep } from '../types';
import { elbowAngle, elbowAngleBest, shoulderWidth, side, tempo } from './helpers';

const TOP_FLEX = 60; // top elbow angle should be <= this (full squeeze)
const BOTTOM_EXT = 150; // bottom elbow angle should be >= this (full stretch)
const ELBOW_DRIFT = 0.18; // elbow horizontal travel / shoulder-width above this => drift
const SWING = 0.12; // shoulder/hip horizontal sway / shoulder-width above this => swing
const ARM_DIFF = 18; // L vs R top-flex difference (deg)

export const curl: ExerciseModule = {
  name: 'curl',
  label: 'Bicep Curl',
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
  ],
  repSignal: (s) => {
    const a = elbowAngleBest(s.lm);
    return Number.isFinite(a) ? a : null;
  },
  topBand: [150, 145], // arm extended (bottom of curl = high angle)
  // Count the rep once the forearm clearly lifts (below ~100°); ROM rules judge the squeeze.
  bottomBand: [95, 100], // arm flexed (top of curl = low angle)
  minAmplitude: 40,
  minDuration: 0.5,
  bottomDirection: 'down', // elbow angle drops as you curl up

  analyzeRep(rep) {
    const s = side(rep.samples[Math.floor(rep.samples.length / 2)].lm, LM.LEFT_ELBOW, LM.RIGHT_ELBOW);
    const angles = rep.samples
      .filter((f) => f.quality >= 0.4)
      .map((f) => elbowAngle(f.lm, s))
      .filter(Number.isFinite);
    const topFlex = Math.min(...angles);
    const bottomExt = Math.max(...angles);
    rep.angles.topFlex = Math.round(topFlex);
    rep.angles.bottomExt = Math.round(bottomExt);

    // Incomplete ROM (top)
    if (topFlex > TOP_FLEX + 15) {
      rep.issues.push(
        makeIssue({
          name: 'Not curling high enough',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Stopping short of the top misses the peak contraction of the biceps.',
          fix: 'Curl until your forearm is near vertical and squeeze at the top.',
          overBy: (topFlex - TOP_FLEX) / 30,
        })
      );
    }
    // Incomplete ROM (bottom)
    if (bottomExt < BOTTOM_EXT - 15) {
      rep.issues.push(
        makeIssue({
          name: 'Not fully extending',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Cutting the bottom short keeps tension off the full muscle and shortens the rep.',
          fix: 'Lower until your arm is nearly straight (a slight bend is fine) before the next rep.',
        })
      );
    }

    // Elbow drift: elbow X moves a lot relative to shoulder during the rep.
    const sw = shoulderWidth(rep.samples[0].lm) || 0.2;
    const elbowIdx = s === 'left' ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
    const shIdx = s === 'left' ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
    const rel = rep.samples
      .filter((f) => f.quality >= 0.4)
      .map((f) => f.lm[elbowIdx].x - f.lm[shIdx].x);
    const drift = rel.length ? Math.max(...rel) - Math.min(...rel) : 0;
    if (drift / sw > ELBOW_DRIFT) {
      rep.issues.push(
        makeIssue({
          name: 'Elbow drifting forward',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Letting the elbow swing forward turns it into a partial front raise and cheats the biceps.',
          fix: 'Pin your upper arm to your side and keep the elbow fixed as you curl.',
          overBy: drift / sw / ELBOW_DRIFT,
        })
      );
    }

    // Shoulder/torso swing (momentum): hip/shoulder horizontal sway.
    const hipIdx = s === 'left' ? LM.LEFT_HIP : LM.RIGHT_HIP;
    const swayArr = rep.samples
      .filter((f) => f.quality >= 0.4)
      .map((f) => f.lm[shIdx].x - f.lm[hipIdx].x);
    const sway = swayArr.length ? Math.max(...swayArr) - Math.min(...swayArr) : 0;
    if (sway / sw > SWING) {
      rep.issues.push(
        makeIssue({
          name: 'Swinging / using momentum',
          severity: 'major',
          affectedReps: [rep.repNumber],
          why: 'Rocking your torso uses momentum and lower-back swing instead of the biceps.',
          fix: 'Stand tall and still. If you have to swing, lower the weight.',
          overBy: sway / sw / SWING,
        })
      );
    }

    scoreRep(rep);
  },

  analyzeSet(reps) {
    const issues: Issue[] = [];
    // Uneven arms: compare per-rep top flex across left vs right when both visible.
    const lefts: number[] = [];
    const rights: number[] = [];
    for (const r of reps) {
      const mid = r.samples[Math.floor(r.samples.length / 2)].lm;
      const l = Math.min(...r.samples.map((f) => elbowAngle(f.lm, 'left')).filter(Number.isFinite));
      const ri = Math.min(...r.samples.map((f) => elbowAngle(f.lm, 'right')).filter(Number.isFinite));
      if (mid[LM.LEFT_ELBOW].visibility > 0.5) lefts.push(l);
      if (mid[LM.RIGHT_ELBOW].visibility > 0.5) rights.push(ri);
    }
    if (lefts.length && rights.length) {
      const diff = Math.abs(avg(lefts) - avg(rights));
      if (diff > ARM_DIFF) {
        issues.push(
          makeIssue({
            name: 'Uneven arms',
            severity: 'minor',
            affectedReps: [],
            why: 'One arm is curling higher than the other across the set.',
            fix: 'Match both arms to the weaker side. Single-arm curls can even them out.',
          })
        );
      }
    }
    // Tempo / momentum across set.
    const cons = reps.map((r) => tempo(r, (s) => elbowAngleBest(s.lm), 'down').concentric);
    if (cons.filter((x) => x > 0 && x < 0.3).length > reps.length / 2) {
      issues.push(
        makeIssue({
          name: 'Curling too fast',
          severity: 'minor',
          affectedReps: [],
          why: 'Fast, jerky reps recruit momentum rather than muscle.',
          fix: 'Curl up in ~1s and lower in ~2s under control.',
        })
      );
    }
    return issues;
  },
};

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
