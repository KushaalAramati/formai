// Headless tests for the camera-setup check, confidence breakdown, rep labels, and muscle map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFraming } from '../lib/analysis/framing';
import { analyzeSet } from '../lib/analysis/engine';
import { squat } from '../lib/analysis/exercises/squat';
import { LM } from '../lib/pose/landmarks';
import type { FrameSample, Landmark } from '../lib/analysis/types';

const DEG = Math.PI / 180;

function fullBody(visibleFeet = true): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  lm[LM.NOSE] = { x: 0.5, y: 0.1, z: 0, visibility: 1 };
  lm[LM.LEFT_SHOULDER] = { x: 0.45, y: 0.3, z: 0, visibility: 1 };
  lm[LM.RIGHT_SHOULDER] = { x: 0.55, y: 0.3, z: 0, visibility: 1 };
  lm[LM.LEFT_HIP] = { x: 0.46, y: 0.55, z: 0, visibility: 1 };
  lm[LM.RIGHT_HIP] = { x: 0.54, y: 0.55, z: 0, visibility: 1 };
  lm[LM.LEFT_KNEE] = { x: 0.46, y: 0.75, z: 0, visibility: 1 };
  lm[LM.RIGHT_KNEE] = { x: 0.54, y: 0.75, z: 0, visibility: 1 };
  lm[LM.LEFT_ANKLE] = { x: 0.46, y: 0.92, z: 0, visibility: visibleFeet ? 1 : 0.1 };
  lm[LM.RIGHT_ANKLE] = { x: 0.54, y: 0.92, z: 0, visibility: visibleFeet ? 1 : 0.1 };
  return lm;
}

test('framing OK when full body incl. feet is visible and centered', () => {
  const fr = checkFraming(fullBody(true), 0.6, true);
  assert.equal(fr.ok, true);
  assert.equal(fr.feetVisible, true);
  assert.equal(fr.message, '');
});

test('framing flags missing feet for squat with a specific message', () => {
  const fr = checkFraming(fullBody(false), 0.6, true);
  assert.equal(fr.feetVisible, false);
  assert.equal(fr.ok, false);
  assert.match(fr.message, /feet/i);
});

test('framing flags no person when landmarks are null', () => {
  const fr = checkFraming(null, 0.6, true);
  assert.equal(fr.ok, false);
  assert.match(fr.message, /step into the frame|no one/i);
});

// Re-use the squat synthetic generator to assert the new SetResult fields exist.
function squatFrame(t: number, kneeDeg: number): FrameSample {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  const a = kneeDeg * DEG;
  const dx = Math.sin(a) * 0.25;
  const dy = -Math.cos(a) * 0.25;
  for (const sgn of [-1, 1]) {
    const ox = 0.5 + sgn * 0.06;
    const kneeY = 0.6;
    const set = (i: number, p: { x: number; y: number }) => (lm[i] = { x: p.x, y: p.y, z: 0, visibility: 1 });
    const hip = { x: ox, y: kneeY - 0.2 };
    const knee = { x: ox, y: kneeY };
    const ankle = { x: ox + dx, y: kneeY + dy };
    if (sgn < 0) {
      set(LM.LEFT_HIP, hip); set(LM.LEFT_KNEE, knee); set(LM.LEFT_ANKLE, ankle);
      set(LM.LEFT_SHOULDER, { x: ox, y: hip.y - 0.2 });
    } else {
      set(LM.RIGHT_HIP, hip); set(LM.RIGHT_KNEE, knee); set(LM.RIGHT_ANKLE, ankle);
      set(LM.RIGHT_SHOULDER, { x: ox, y: hip.y - 0.2 });
    }
  }
  return { t, lm, quality: 1 };
}
function squatSet(n: number, top = 172, bottom = 88): FrameSample[] {
  const frames: FrameSample[] = [];
  let t = 0; const dt = 0.1; const phase = 8;
  frames.push(squatFrame(t, top));
  for (let r = 0; r < n; r++) {
    for (let i = 1; i <= phase; i++) frames.push(squatFrame((t += dt), top + ((bottom - top) * i) / phase));
    for (let i = 1; i <= phase; i++) frames.push(squatFrame((t += dt), bottom + ((top - bottom) * i) / phase));
  }
  return frames;
}

test('SetResult carries muscle groups, confidence breakdown, and rep labels', () => {
  const r = analyzeSet(squat, squatSet(5));
  assert.deepEqual(r.muscleGroups, ['Quads', 'Glutes', 'Hamstrings']);
  assert.ok(r.confidenceBreakdown);
  assert.equal(typeof r.confidenceBreakdown.jointsVisible, 'boolean');
  assert.ok(r.reps.every((rep) => ['good', 'minor', 'poor'].includes(rep.label)));
});
