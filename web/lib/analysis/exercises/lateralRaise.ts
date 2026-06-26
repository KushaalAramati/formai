// Lateral raise rule engine. Capture from the FRONT.
import { LM } from '../../pose/landmarks';
import { makeIssue, scoreRep } from '../scoring';
import type { ExerciseModule, Issue } from '../types';
import { elbowAngle, shoulderAbduction, side, torsoLean } from './helpers';

const RAISE_TARGET = 80; // abduction angle at top should reach ~80-90° (arms to shoulder height)
const OVER_RAISE = 110; // above this => raising too high (traps take over)
const SWING = 14; // torso lean swing across rep => momentum
const ELBOW_MIN = 110; // elbow should stay fairly straight (slight bend ok)

export const lateralRaise: ExerciseModule = {
  name: 'lateralRaise',
  label: 'Lateral Raise',
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
    const sd = side(s.lm, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
    const a = shoulderAbduction(s.lm, sd);
    return Number.isFinite(a) ? a : null;
  },
  topBand: [25, 30], // arms down (low abduction)
  bottomBand: [75, 70], // arms raised (high abduction) -> "bottom" of FSM
  minAmplitude: 35,
  minDuration: 0.6,
  bottomDirection: 'up', // abduction angle RISES at the top of the movement

  analyzeRep(rep) {
    const sd = side(rep.samples[Math.floor(rep.samples.length / 2)].lm, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
    const abds = rep.samples.filter((f) => f.quality >= 0.4).map((f) => shoulderAbduction(f.lm, sd));
    const peak = Math.max(...abds.filter(Number.isFinite));
    rep.angles.peakRaise = Math.round(peak);

    if (peak < RAISE_TARGET - 15) {
      rep.issues.push(
        makeIssue({
          name: 'Not raising high enough',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Stopping low keeps the side delts from doing full work.',
          fix: 'Raise until your arms reach about shoulder height (a "T" shape).',
          overBy: (RAISE_TARGET - peak) / 25,
        })
      );
    } else if (peak > OVER_RAISE) {
      rep.issues.push(
        makeIssue({
          name: 'Raising too high',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Going well above shoulder height shifts the work to your traps.',
          fix: 'Stop at shoulder height — arms parallel to the floor.',
        })
      );
    }

    const lean = rep.samples.filter((f) => f.quality >= 0.4).map((f) => torsoLean(f.lm));
    if (lean.length && Math.max(...lean) - Math.min(...lean) > SWING) {
      rep.issues.push(
        makeIssue({
          name: 'Using body swing',
          severity: 'major',
          affectedReps: [rep.repNumber],
          why: 'Rocking the torso heaves the weight up with momentum instead of the shoulders.',
          fix: 'Stand still and raise under control. Lower the weight if you have to swing.',
        })
      );
    }

    const elbow = Math.min(...rep.samples.map((f) => elbowAngle(f.lm, sd)).filter(Number.isFinite));
    if (elbow < ELBOW_MIN - 20) {
      rep.issues.push(
        makeIssue({
          name: 'Too much elbow bend',
          severity: 'minor',
          affectedReps: [rep.repNumber],
          why: 'Bending the elbows a lot shortens the lever and turns it into an upright row.',
          fix: 'Keep a soft, fixed bend in the elbows throughout.',
        })
      );
    }
    scoreRep(rep);
  },

  analyzeSet(): Issue[] {
    return [];
  },
};
