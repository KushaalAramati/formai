// Tiny in-memory hand-off between the Analyze page and the Dashboard.
// (Phase 6: replace with POST /api/sessions persistence to Postgres.)
import type { FrameSample, SetResult } from './analysis/types';
import type { Snapshot } from './pose/frameCapture';

interface Stored {
  result: SetResult;
  samples: FrameSample[];
  exerciseName: string;
  snapshots: Snapshot[];
}

let current: Stored | null = null;

export function setResult(s: Stored) {
  current = s;
}
export function getResult(): Stored | null {
  return current;
}
export function clearResult() {
  current = null;
}
