// Frame quality gating: decide whether a frame is usable for a given exercise.
import { LM } from '../pose/landmarks';
import { mean } from './math';
import type { ConfidenceBreakdown, FrameSample, Landmark } from './types';

/** Average visibility of the joints this exercise needs. 0..1. */
export function frameQuality(lm: Landmark[], trackedJoints: number[]): number {
  if (!lm || lm.length < 33) return 0;
  const vis = trackedJoints
    .map((i) => lm[i]?.visibility ?? 0)
    .filter((x) => Number.isFinite(x));
  if (!vis.length) return 0;
  // also penalize landmarks outside the frame [0,1]
  const inFrame = trackedJoints.map((i) => {
    const p = lm[i];
    if (!p) return 0;
    return p.x >= -0.02 && p.x <= 1.02 && p.y >= -0.02 && p.y <= 1.02 ? 1 : 0.4;
  });
  return mean(vis) * mean(inFrame);
}

const VIS_THRESHOLD = 0.5;

/** Is this single frame good enough to analyze? */
export function isUsable(s: FrameSample): boolean {
  return s.quality >= VIS_THRESHOLD;
}

/** Aggregate set-level confidence + warnings from sampled frames. */
export function assessCapture(
  samples: FrameSample[],
  trackedJoints: number[]
): { confidence: number; uncertain: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (!samples.length) {
    return { confidence: 0, uncertain: true, warnings: ['No usable frames were detected.'] };
  }
  const usable = samples.filter(isUsable);
  const usableFrac = usable.length / samples.length;
  const avgQuality = mean(samples.map((s) => s.quality));

  if (usableFrac < 0.6) {
    warnings.push(
      'Your full body was not clearly visible for much of the video. Step back so your whole body is in frame.'
    );
  }
  if (avgQuality < 0.55) {
    warnings.push(
      'Video/pose quality is low (lighting, distance, or angle). Results may be unreliable.'
    );
  }
  if (samples.length < 15) {
    warnings.push('The clip is very short — record the full set for better analysis.');
  }

  const confidence = Math.max(0, Math.min(1, 0.5 * usableFrac + 0.5 * avgQuality));
  const uncertain = confidence < 0.55 || usableFrac < 0.5;
  return { confidence, uncertain, warnings };
}

/** Build the user-facing confidence breakdown (which checks passed) over the set. */
export function confidenceBreakdown(
  samples: FrameSample[],
  trackedJoints: number[],
  confidence: number,
  requireFeet: boolean
): ConfidenceBreakdown {
  const usable = samples.filter(isUsable);
  const frac = (pred: (s: FrameSample) => boolean) =>
    samples.length ? samples.filter(pred).length / samples.length : 0;

  const vis = (s: FrameSample, i: number) => s.lm[i]?.visibility ?? 0;
  const feetVisible =
    frac((s) => Math.max(vis(s, LM.LEFT_ANKLE), vis(s, LM.RIGHT_ANKLE)) > 0.5) > 0.5;
  const headVisible = frac((s) => vis(s, LM.NOSE) > 0.4) > 0.5;
  const jointsVisible = usable.length / Math.max(1, samples.length) > 0.6;
  const centered =
    frac((s) => {
      const x = ((s.lm[LM.LEFT_HIP]?.x ?? 0.5) + (s.lm[LM.RIGHT_HIP]?.x ?? 0.5)) / 2;
      return x > 0.25 && x < 0.75;
    }) > 0.5;

  return {
    fullBodyVisible: jointsVisible && headVisible && (!requireFeet || feetVisible),
    feetVisible,
    jointsVisible,
    centered,
    lightingOk: mean(samples.map((s) => s.quality)) > 0.4,
    trackingOk: usable.length / Math.max(1, samples.length) > 0.6,
    score: confidence,
  };
}
