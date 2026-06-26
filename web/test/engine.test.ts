// Headless proof that the analysis engine works without a browser.
// Run: npm test  (uses tsx + node:test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSet } from '../lib/analysis/engine';
import { countReps } from '../lib/analysis/repCounter';
import { squat } from '../lib/analysis/exercises/squat';
import { LM } from '../lib/pose/landmarks';
import type { FrameSample, Landmark } from '../lib/analysis/types';

const DEG = Math.PI / 180;

/** Build a side-view squat frame whose knee angle equals `kneeDeg`. */
function squatFrame(t: number, kneeDeg: number): FrameSample {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  const a = kneeDeg * DEG;
  const dx = Math.sin(a) * 0.25;
  const dy = -Math.cos(a) * 0.25;
  for (const sgn of [-1, 1]) {
    const ox = 0.5 + sgn * 0.06;
    const kneeY = 0.6;
    const hip = { x: ox, y: kneeY - 0.2 };
    const knee = { x: ox, y: kneeY };
    const ankle = { x: ox + dx, y: kneeY + dy }; // dy>0 when straight (cos>0)
    const set = (i: number, p: { x: number; y: number }) =>
      (lm[i] = { x: p.x, y: p.y, z: 0, visibility: 1 });
    if (sgn < 0) {
      set(LM.LEFT_HIP, hip);
      set(LM.LEFT_KNEE, knee);
      set(LM.LEFT_ANKLE, ankle);
      set(LM.LEFT_SHOULDER, { x: ox, y: hip.y - 0.2 });
      set(LM.LEFT_HEEL, { x: ankle.x - 0.05, y: ankle.y + 0.02 });
      set(LM.LEFT_FOOT, { x: ankle.x + 0.05, y: ankle.y + 0.02 });
    } else {
      set(LM.RIGHT_HIP, hip);
      set(LM.RIGHT_KNEE, knee);
      set(LM.RIGHT_ANKLE, ankle);
      set(LM.RIGHT_SHOULDER, { x: ox, y: hip.y - 0.2 });
      set(LM.RIGHT_HEEL, { x: ankle.x - 0.05, y: ankle.y + 0.02 });
      set(LM.RIGHT_FOOT, { x: ankle.x + 0.05, y: ankle.y + 0.02 });
    }
  }
  return { t, lm, quality: 1 };
}

/** Generate N reps oscillating between `top` and `bottom` knee angles. */
function squatSet(nReps: number, top = 172, bottom = 88): FrameSample[] {
  const frames: FrameSample[] = [];
  let t = 0;
  const dt = 0.1;
  const phase = 8;
  frames.push(squatFrame(t, top));
  for (let r = 0; r < nReps; r++) {
    for (let i = 1; i <= phase; i++) frames.push(squatFrame((t += dt), top + ((bottom - top) * i) / phase));
    for (let i = 1; i <= phase; i++) frames.push(squatFrame((t += dt), bottom + ((top - bottom) * i) / phase));
  }
  return frames;
}

test('synthetic squat frame produces the requested knee angle', () => {
  const f = squatFrame(0, 90);
  const sig = squat.repSignal(f)!;
  assert.ok(Math.abs(sig - 90) < 2, `expected ~90, got ${sig}`);
});

test('rep counter counts the right number of clean reps', () => {
  for (const n of [3, 5, 8]) {
    const reps = countReps(squat, squatSet(n));
    assert.equal(reps.length, n, `expected ${n} reps, got ${reps.length}`);
  }
});

test('good deep squats score high with no major issues', () => {
  const r = analyzeSet(squat, squatSet(5, 172, 88));
  assert.equal(r.repCount, 5);
  assert.ok(r.overallScore >= 85, `expected high score, got ${r.overallScore}`);
  assert.equal(r.issues.filter((i) => i.severity === 'major').length, 0);
});

test('shallow squats are flagged as shallow depth', () => {
  const r = analyzeSet(squat, squatSet(4, 172, 135)); // never reach parallel
  const shallow = r.issues.find((i) => i.name === 'Shallow depth');
  assert.ok(shallow, 'expected a shallow-depth issue');
  assert.ok(r.overallScore < 85, `expected reduced score, got ${r.overallScore}`);
});

test('best/worst reps and summary are populated', () => {
  const r = analyzeSet(squat, squatSet(5));
  assert.ok(r.bestRep && r.worstRep);
  assert.match(r.summary, /Exercise: Squat/);
  assert.match(r.summary, /Overall form score/);
});
