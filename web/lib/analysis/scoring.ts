// Scoring + issue helpers shared by every exercise module.
import type { Issue, Rep, Severity } from './types';
import { clamp } from './math';

export const PENALTY: Record<Severity, number> = { info: 0, minor: 6, major: 15 };

/**
 * Build an Issue and compute its penalty.
 * `overBy` (0..1+) scales the penalty by how far past threshold the fault is,
 * so a barely-missed depth costs less than a deep miss.
 */
export function makeIssue(opts: {
  name: string;
  severity: Severity;
  affectedReps: number[];
  why: string;
  fix: string;
  overBy?: number;
}): Issue {
  const scale = clamp(opts.overBy ?? 1, 0.4, 1.6);
  const penalty = Math.round(PENALTY[opts.severity] * scale);
  return {
    name: opts.name,
    severity: opts.severity,
    affectedReps: opts.affectedReps,
    why: opts.why,
    fix: opts.fix,
    penalty,
  };
}

/** Apply a rep's own issues to its score + a qualitative label + pick a key frame. */
export function scoreRep(rep: Rep): void {
  const total = rep.issues.reduce((s, i) => s + i.penalty, 0);
  rep.score = Math.round(clamp(100 - total, 0, 100));
  rep.label = rep.score >= 80 ? 'good' : rep.score >= 60 ? 'minor' : 'poor';
  // Key frame = the deepest part of the rep (middle of the window is a good default;
  // exercises set rep.angles during analyzeRep, but the bottom is the most telling moment).
  rep.keyFrameIndex = Math.floor(rep.samples.length / 2);
}

/** Mean of rep scores, minus any set-level penalties. */
export function scoreSet(reps: Rep[], setIssues: Issue[]): number {
  if (!reps.length) return 0;
  const repMean = reps.reduce((s, r) => s + r.score, 0) / reps.length;
  const setPenalty = setIssues.reduce((s, i) => s + i.penalty, 0);
  return Math.round(clamp(repMean - setPenalty, 0, 100));
}

export function bestWorst(reps: Rep[]): { best: number | null; worst: number | null } {
  if (!reps.length) return { best: null, worst: null };
  let best = reps[0];
  let worst = reps[0];
  for (const r of reps) {
    const rMajors = r.issues.filter((i) => i.severity === 'major').length;
    const bMajors = best.issues.filter((i) => i.severity === 'major').length;
    const wMajors = worst.issues.filter((i) => i.severity === 'major').length;
    if (r.score > best.score || (r.score === best.score && rMajors < bMajors)) best = r;
    if (r.score < worst.score || (r.score === worst.score && rMajors > wMajors)) worst = r;
  }
  return { best: best.repNumber, worst: worst.repNumber };
}

/** Merge rep-level issues with the same name into one, unioning affected reps. */
export function mergeIssues(reps: Rep[], setIssues: Issue[]): Issue[] {
  const byName = new Map<string, Issue>();
  for (const r of reps) {
    for (const iss of r.issues) {
      const ex = byName.get(iss.name);
      if (ex) {
        ex.affectedReps = Array.from(new Set([...ex.affectedReps, ...iss.affectedReps])).sort(
          (a, b) => a - b
        );
        if (PENALTY[iss.severity] > PENALTY[ex.severity]) ex.severity = iss.severity;
      } else {
        byName.set(iss.name, { ...iss, affectedReps: [...iss.affectedReps] });
      }
    }
  }
  for (const iss of setIssues) {
    if (!byName.has(iss.name)) byName.set(iss.name, iss);
  }
  // Sort by severity then by number of reps affected.
  return Array.from(byName.values()).sort(
    (a, b) =>
      PENALTY[b.severity] - PENALTY[a.severity] || b.affectedReps.length - a.affectedReps.length
  );
}
