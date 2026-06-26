// Pre-workout camera-setup check: given the latest pose frame (+ optional brightness), decide
// whether the user is framed well enough to start, and produce a specific fix message.
import { LM } from '../pose/landmarks';
import { mean } from './math';
import type { Landmark } from './types';

export interface FramingResult {
  ok: boolean;
  fullBodyVisible: boolean;
  feetVisible: boolean;
  jointsVisible: boolean;
  centered: boolean;
  lightingOk: boolean;
  /** the single most important thing to fix right now (empty if ok). */
  message: string;
  /** 0..1 readiness. */
  score: number;
}

const KEY_JOINTS = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
];

/**
 * @param lm landmarks (or null if no person detected)
 * @param brightness optional 0..1 average frame brightness (low => poor lighting)
 * @param requireFeet whether this exercise needs the feet (squat/deadlift/lunge yes)
 */
export function checkFraming(
  lm: Landmark[] | null,
  brightness: number | null,
  requireFeet: boolean
): FramingResult {
  if (!lm || lm.length < 33) {
    return {
      ok: false,
      fullBodyVisible: false,
      feetVisible: false,
      jointsVisible: false,
      centered: false,
      lightingOk: brightness == null ? true : brightness > 0.2,
      message: 'No one detected — step into the frame so your whole body is visible.',
      score: 0,
    };
  }

  const vis = (i: number) => lm[i]?.visibility ?? 0;
  const inFrame = (i: number) => {
    const p = lm[i];
    return p && p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98;
  };

  const jointsVisible = mean(KEY_JOINTS.map((i) => vis(i))) > 0.6;
  const feetVisible =
    Math.max(vis(LM.LEFT_ANKLE), vis(LM.RIGHT_ANKLE)) > 0.5 &&
    (inFrame(LM.LEFT_ANKLE) || inFrame(LM.RIGHT_ANKLE));
  const headVisible = vis(LM.NOSE) > 0.4;
  const fullBodyVisible = jointsVisible && feetVisible && headVisible;

  // centering: mid-hip x near center, and body spans a reasonable vertical extent.
  const midHipX = (lm[LM.LEFT_HIP].x + lm[LM.RIGHT_HIP].x) / 2;
  const centered = midHipX > 0.3 && midHipX < 0.7;

  const lightingOk = brightness == null ? true : brightness > 0.22;

  // Pick the single most important fix, in priority order.
  let message = '';
  if (!jointsVisible) message = 'Step back and face the camera — your major joints are not clearly visible.';
  else if (requireFeet && !feetVisible) message = 'Move your phone slightly lower — your feet are not visible.';
  else if (!headVisible) message = 'Move your phone slightly higher — your head is cut off.';
  else if (!centered) message = midHipX <= 0.3 ? 'Move to your right to center yourself.' : 'Move to your left to center yourself.';
  else if (!lightingOk) message = 'It looks dark — add more light so the camera can see you.';

  const checks = [
    jointsVisible,
    requireFeet ? feetVisible : true,
    headVisible,
    centered,
    lightingOk,
  ];
  const score = checks.filter(Boolean).length / checks.length;
  const ok = score >= 0.8 && jointsVisible && (!requireFeet || feetVisible);

  return { ok, fullBodyVisible, feetVisible, jointsVisible, centered, lightingOk, message, score };
}

/** Average brightness 0..1 from a canvas/video by sampling pixels. Browser-only. */
export function estimateBrightness(source: CanvasImageSource, w = 64, h = 64): number | null {
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / (w * h) / 255;
  } catch {
    return null;
  }
}
