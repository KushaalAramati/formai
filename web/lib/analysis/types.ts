// Framework-free types shared by the whole analysis engine.
// These mirror the Phase-4 Postgres schema field names so persistence is a 1:1 map.

export type Severity = 'info' | 'minor' | 'major';
export type CameraAngle = 'side' | 'front' | '45';
export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';
export type RepLabel = 'good' | 'minor' | 'poor';

/** Per-check breakdown of why confidence is what it is (shown to the user for trust). */
export interface ConfidenceBreakdown {
  fullBodyVisible: boolean;
  feetVisible: boolean;
  jointsVisible: boolean;
  centered: boolean;
  lightingOk: boolean;
  trackingOk: boolean;
  /** 0..1 */
  score: number;
}

/** One MediaPipe landmark: normalized [0,1] image coords, z depth, and visibility [0,1]. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** One sampled frame: timestamp (seconds) + 33 landmarks. */
export interface FrameSample {
  t: number;
  lm: Landmark[];
  /** 0..1 — how usable this frame is for the current exercise (joint visibility gate). */
  quality: number;
}

/** A detected form fault. */
export interface Issue {
  name: string;
  severity: Severity;
  /** rep numbers (1-based) affected; empty for set-level issues. */
  affectedReps: number[];
  /** how much it matters, plain language. */
  why: string;
  /** what to do about it. */
  fix: string;
  /** internal penalty already applied to scores (for transparency). */
  penalty: number;
}

/** A single counted rep. */
export interface Rep {
  repNumber: number;
  startT: number;
  endT: number;
  samples: FrameSample[];
  /** representative angles for this rep (exercise-specific keys). */
  angles: Record<string, number>;
  issues: Issue[];
  score: number;
  label: RepLabel;
  /** sample index (within rep.samples) most representative of the fault/extreme — for key frames. */
  keyFrameIndex: number;
}

/** Full result for one analyzed set. */
export interface SetResult {
  exercise: string;
  muscleGroups: string[];
  repCount: number;
  overallScore: number;
  /** 0..1 — how confident we are given video quality / visibility. */
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  uncertain: boolean;
  bestRep: number | null;
  worstRep: number | null;
  reps: Rep[];
  issues: Issue[]; // merged, de-duplicated, set + rep level
  /** plain-language coaching, produced by lib/llm/coach.ts */
  summary: string;
  /** warnings about capture quality / angle. */
  warnings: string[];
  /** for plank: hold seconds instead of reps. */
  holdSeconds?: number;
}

export interface ExerciseModule {
  name: string;
  label: string;
  requiredCameraAngle: CameraAngle;
  trackedJoints: number[];
  /** scalar that rises/falls through a rep; null if not measurable this frame. */
  repSignal: (s: FrameSample) => number | null;
  /** [enterTop, exitTop] and [enterBottom, exitBottom] with hysteresis. */
  topBand: [number, number];
  bottomBand: [number, number];
  /** rep must have at least this much amplitude (signal units) to count. */
  minAmplitude: number;
  /** rep must last at least this long (s) to count. */
  minDuration: number;
  /** signal goes DOWN to reach bottom (squat knee angle) or UP (curl: angle goes down too).
   *  'down' = bottom is a low signal value; 'up' = bottom is a high value. */
  bottomDirection: 'down' | 'up';
  analyzeRep: (rep: Rep, ctx: SetContext) => void;
  analyzeSet: (reps: Rep[], samples: FrameSample[]) => Issue[];
  /** plank-style timed hold instead of reps. */
  isHold?: boolean;
}

export interface SetContext {
  exercise: ExerciseModule;
  allReps: Rep[];
}

/** Follow-up context the user provides after analysis. */
export interface UserContext {
  pain?: boolean;
  painLocation?: string;
  weight?: string;
  rpe?: number; // 1..10
  goal?: 'strength' | 'muscle' | 'endurance' | 'general';
  level?: TrainingLevel;
  injury?: boolean;
  equipment?: ('bodyweight' | 'dumbbells' | 'barbell' | 'machines')[];
}
