// Orchestrates a full analysis: quality gate -> rep counting -> per-rep + set rules -> scoring.
import { countReps } from './repCounter';
import { assessCapture, confidenceBreakdown } from './quality';
import { bestWorst, mergeIssues, scoreSet } from './scoring';
import { musclesFor } from './muscleMap';
import { renderCoaching } from '../llm/coach';
import type { ExerciseModule, FrameSample, SetResult } from './types';

const FEET_EXERCISES = new Set(['squat', 'deadlift', 'rdl', 'lunge']);

export function analyzeSet(ex: ExerciseModule, samples: FrameSample[]): SetResult {
  const { confidence, uncertain, warnings } = assessCapture(samples, ex.trackedJoints);
  const requireFeet = FEET_EXERCISES.has(ex.name);
  const breakdown = confidenceBreakdown(samples, ex.trackedJoints, confidence, requireFeet);
  const muscleGroups = musclesFor(ex.name);

  // Plank: timed hold path.
  if (ex.isHold) {
    const good = samples.filter((s) => s.quality >= 0.5);
    const holdSeconds =
      good.length >= 2 ? good[good.length - 1].t - good[0].t : 0;
    const setIssues = ex.analyzeSet([], samples);
    const overallScore = Math.max(0, 100 - setIssues.reduce((s, i) => s + i.penalty, 0));
    const result: SetResult = {
      exercise: ex.name,
      muscleGroups,
      repCount: 0,
      holdSeconds: Math.round(holdSeconds),
      overallScore,
      confidence,
      confidenceBreakdown: breakdown,
      uncertain,
      bestRep: null,
      worstRep: null,
      reps: [],
      issues: setIssues,
      summary: '',
      warnings,
    };
    result.summary = renderCoaching(ex, result);
    return result;
  }

  const reps = countReps(ex, samples);
  const ctx = { exercise: ex, allReps: reps };
  for (const rep of reps) ex.analyzeRep(rep, ctx);
  const setIssues = ex.analyzeSet(reps, samples);

  const issues = mergeIssues(reps, setIssues);
  const overallScore = reps.length ? scoreSet(reps, setIssues) : 0;
  const { best, worst } = bestWorst(reps);

  const result: SetResult = {
    exercise: ex.name,
    muscleGroups,
    repCount: reps.length,
    overallScore,
    confidence,
    confidenceBreakdown: breakdown,
    uncertain: uncertain || reps.length === 0,
    bestRep: best,
    worstRep: worst,
    reps,
    issues,
    summary: '',
    warnings:
      reps.length === 0
        ? [
            ...warnings,
            'No clean reps were detected. Check the camera angle and that your full body is visible.',
          ]
        : warnings,
  };
  result.summary = renderCoaching(ex, result);
  return result;
}
