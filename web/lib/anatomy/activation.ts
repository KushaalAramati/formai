// Muscle-activation model. IMPORTANT: this does NOT measure muscle activation (that needs EMG).
// It is an INFERENCE driven by the form-analysis engine:
//   - every exercise lights up the muscles it targets (green / teal), and
//   - each detected form fault lights up the muscle it over-recruits (red) or under-works (amber).
// Two entry points produce the same MuscleState map: repActivation (review) and liveActivation (live).
import { LM } from '../pose/landmarks';
import { kneeAngle, torsoLean, bodyLine, side, shoulderWidth } from '../analysis/exercises/helpers';
import type { FrameSample, Rep } from '../analysis/types';
import type { MuscleId } from './muscles';

export type MuscleState = 'primary' | 'secondary' | 'underactive' | 'compensating' | 'idle';

export interface MuscleActivation {
  state: MuscleState;
  /** 0..1 glow strength. */
  intensity: number;
}

export type ActivationMap = Partial<Record<MuscleId, MuscleActivation>>;

const STATE_RANK: Record<MuscleState, number> = {
  idle: 0,
  secondary: 1,
  primary: 2,
  underactive: 3,
  compensating: 4,
};

/** Set a muscle, but never downgrade a stronger signal (compensating wins over primary, etc.). */
function set(map: ActivationMap, id: MuscleId, state: MuscleState, intensity: number) {
  const cur = map[id];
  if (!cur || STATE_RANK[state] >= STATE_RANK[cur.state]) {
    map[id] = { state, intensity: Math.max(0, Math.min(1, intensity)) };
  }
}

interface Target {
  id: MuscleId;
  state: 'primary' | 'secondary';
}

const TARGETS: Record<string, Target[]> = {
  squat: [
    { id: 'quads', state: 'primary' },
    { id: 'glutes', state: 'primary' },
    { id: 'hamstrings', state: 'secondary' },
    { id: 'abs', state: 'secondary' },
  ],
  pushup: [
    { id: 'chest', state: 'primary' },
    { id: 'frontDelts', state: 'secondary' },
    { id: 'triceps', state: 'secondary' },
    { id: 'abs', state: 'secondary' },
  ],
  curl: [
    { id: 'biceps', state: 'primary' },
    { id: 'forearms', state: 'secondary' },
  ],
  shoulderPress: [
    { id: 'frontDelts', state: 'primary' },
    { id: 'sideDelts', state: 'secondary' },
    { id: 'triceps', state: 'secondary' },
  ],
  lateralRaise: [{ id: 'sideDelts', state: 'primary' }],
  plank: [
    { id: 'abs', state: 'primary' },
    { id: 'obliques', state: 'secondary' },
  ],
};

interface FaultEffect {
  id: MuscleId;
  state: 'compensating' | 'underactive';
}

// Maps an exercise's detected issue (by its exact name from the rule engine) to the muscle it
// over-recruits (compensating, red) or robs of work (underactive, amber).
const FAULTS: Record<string, Record<string, FaultEffect[]>> = {
  squat: {
    'Excessive forward lean': [{ id: 'lowerBack', state: 'compensating' }],
    'Knees caving inward': [{ id: 'adductors', state: 'compensating' }],
    'Heels lifting': [{ id: 'calves', state: 'compensating' }],
    'Shallow depth': [
      { id: 'glutes', state: 'underactive' },
      { id: 'hamstrings', state: 'underactive' },
    ],
    'Slightly above parallel': [{ id: 'glutes', state: 'underactive' }],
  },
  pushup: {
    'Hips sagging': [{ id: 'lowerBack', state: 'compensating' }],
    'Hips piking up': [
      { id: 'chest', state: 'underactive' },
      { id: 'frontDelts', state: 'compensating' },
    ],
    'Head dropping': [{ id: 'traps', state: 'compensating' }],
    'Incomplete range of motion': [
      { id: 'chest', state: 'underactive' },
      { id: 'triceps', state: 'underactive' },
    ],
    'Slightly short depth': [{ id: 'chest', state: 'underactive' }],
  },
  curl: {
    'Swinging / using momentum': [
      { id: 'lowerBack', state: 'compensating' },
      { id: 'frontDelts', state: 'compensating' },
    ],
    'Elbow drifting forward': [{ id: 'frontDelts', state: 'compensating' }],
    'Not curling high enough': [{ id: 'biceps', state: 'underactive' }],
    'Not fully extending': [{ id: 'biceps', state: 'underactive' }],
  },
  shoulderPress: {
    'Leaning back': [{ id: 'lowerBack', state: 'compensating' }],
    'Not locking out overhead': [{ id: 'triceps', state: 'underactive' }],
    'Short range at the bottom': [{ id: 'sideDelts', state: 'underactive' }],
  },
  lateralRaise: {
    'Using body swing': [
      { id: 'lowerBack', state: 'compensating' },
      { id: 'traps', state: 'compensating' },
    ],
    'Raising too high': [{ id: 'traps', state: 'compensating' }],
    'Not raising high enough': [{ id: 'sideDelts', state: 'underactive' }],
    'Too much elbow bend': [{ id: 'sideDelts', state: 'underactive' }],
  },
  plank: {
    'Hips sagging': [{ id: 'lowerBack', state: 'compensating' }],
    'Form breaking down over time': [{ id: 'abs', state: 'underactive' }],
  },
};

function applyTargets(map: ActivationMap, exercise: string, intensity: number) {
  for (const t of TARGETS[exercise] ?? []) {
    set(map, t.id, t.state, t.state === 'primary' ? intensity : intensity * 0.7);
  }
}

/** Review: muscle states for one analyzed rep, from its score + detected issues. */
export function repActivation(exercise: string, rep: Rep): ActivationMap {
  const map: ActivationMap = {};
  // Target intensity scales with how well the rep was performed.
  applyTargets(map, exercise, 0.55 + (rep.score / 100) * 0.45);

  const faultTable = FAULTS[exercise] ?? {};
  for (const issue of rep.issues) {
    const effects = faultTable[issue.name];
    if (!effects) continue;
    const strength = issue.severity === 'major' ? 1 : issue.severity === 'minor' ? 0.7 : 0.4;
    for (const e of effects) set(map, e.id, e.state, strength);
  }
  return map;
}

/** Review (whole set): worst-case union across reps — any muscle ever compensating shows. */
export function setActivation(exercise: string, reps: Rep[]): ActivationMap {
  const map: ActivationMap = {};
  applyTargets(map, exercise, 0.9);
  for (const rep of reps) {
    const r = repActivation(exercise, rep);
    for (const id of Object.keys(r) as MuscleId[]) set(map, id, r[id]!.state, r[id]!.intensity);
  }
  return map;
}

// ---- Live (per frame) -------------------------------------------------------
// Only flags faults a single 2D camera can actually measure in the sagittal plane
// (forward lean, hip sag, body swing). We deliberately do NOT infer knee valgus live
// from a side view — the camera geometry can't see it.

function torsoSwing(lm: FrameSample['lm']): number {
  const s = side(lm, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER);
  const sh = s === 'left' ? lm[LM.LEFT_SHOULDER] : lm[LM.RIGHT_SHOULDER];
  const hip = s === 'left' ? lm[LM.LEFT_HIP] : lm[LM.RIGHT_HIP];
  const sw = shoulderWidth(lm) || 0.2;
  return Math.abs(sh.x - hip.x) / sw;
}

/** Live: muscle states for the current frame of an exercise. */
export function liveActivation(exercise: string, frame: FrameSample): ActivationMap {
  const map: ActivationMap = {};
  applyTargets(map, exercise, 0.85);
  if (frame.quality < 0.4) return map;
  const lm = frame.lm;

  switch (exercise) {
    case 'squat': {
      if (torsoLean(lm) > 45) set(map, 'lowerBack', 'compensating', 0.85);
      break;
    }
    case 'pushup':
    case 'plank': {
      if (bodyLine(lm) < 162) set(map, 'lowerBack', 'compensating', 0.85);
      break;
    }
    case 'curl': {
      if (torsoSwing(lm) > 0.12) {
        set(map, 'lowerBack', 'compensating', 0.8);
        set(map, 'frontDelts', 'compensating', 0.7);
      }
      break;
    }
    case 'shoulderPress': {
      if (torsoLean(lm) > 18) set(map, 'lowerBack', 'compensating', 0.8);
      break;
    }
    case 'lateralRaise': {
      if (torsoSwing(lm) > 0.12) {
        set(map, 'lowerBack', 'compensating', 0.8);
        set(map, 'traps', 'compensating', 0.7);
      }
      break;
    }
  }
  // also flag deep knee bend as "quads loaded" emphasis for squat (informational)
  if (exercise === 'squat' && kneeAngle(lm) < 120) set(map, 'quads', 'primary', 1);
  return map;
}
