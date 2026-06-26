import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repActivation, liveActivation } from '../lib/anatomy/activation';
import { LM } from '../lib/pose/landmarks';
import type { FrameSample, Issue, Landmark, Rep } from '../lib/analysis/types';

function rep(score: number, issues: Partial<Issue>[]): Rep {
  return {
    repNumber: 1,
    startT: 0,
    endT: 1,
    samples: [],
    angles: {},
    issues: issues.map((i) => ({
      name: i.name ?? '',
      severity: i.severity ?? 'minor',
      affectedReps: [1],
      why: '',
      fix: '',
      penalty: 0,
    })),
    score,
    label: 'good',
    keyFrameIndex: 0,
  };
}

test('a clean squat lights the target muscles, nothing compensating', () => {
  const m = repActivation('squat', rep(95, []));
  assert.equal(m.quads?.state, 'primary');
  assert.equal(m.glutes?.state, 'primary');
  const compensating = Object.values(m).filter((a) => a?.state === 'compensating');
  assert.equal(compensating.length, 0);
});

test('forward-lean squat lights the lower back as compensating (red)', () => {
  const m = repActivation('squat', rep(70, [{ name: 'Excessive forward lean', severity: 'major' }]));
  assert.equal(m.lowerBack?.state, 'compensating');
  assert.ok((m.lowerBack?.intensity ?? 0) > 0.8);
});

test('shallow squat marks glutes as underactive (amber), not compensating', () => {
  const m = repActivation('squat', rep(72, [{ name: 'Shallow depth', severity: 'major' }]));
  assert.equal(m.glutes?.state, 'underactive');
});

test('knee cave lights adductors as compensating', () => {
  const m = repActivation('squat', rep(60, [{ name: 'Knees caving inward', severity: 'major' }]));
  assert.equal(m.adductors?.state, 'compensating');
});

test('curl with swing recruits lower back + front delts', () => {
  const m = repActivation('curl', rep(55, [{ name: 'Swinging / using momentum', severity: 'major' }]));
  assert.equal(m.biceps?.state, 'primary');
  assert.equal(m.lowerBack?.state, 'compensating');
  assert.equal(m.frontDelts?.state, 'compensating');
});

function frame(shoulderDx: number): FrameSample {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  lm[LM.LEFT_HIP] = { x: 0.5, y: 0.6, z: 0, visibility: 1 };
  lm[LM.RIGHT_HIP] = { x: 0.5, y: 0.6, z: 0, visibility: 1 };
  lm[LM.LEFT_SHOULDER] = { x: 0.5 + shoulderDx, y: 0.4, z: 0, visibility: 1 };
  lm[LM.RIGHT_SHOULDER] = { x: 0.5 + shoulderDx, y: 0.4, z: 0, visibility: 1 };
  // legs roughly straight so knee angle is high (no deep-knee quad flag)
  lm[LM.LEFT_KNEE] = { x: 0.5, y: 0.78, z: 0, visibility: 1 };
  lm[LM.RIGHT_KNEE] = { x: 0.5, y: 0.78, z: 0, visibility: 1 };
  lm[LM.LEFT_ANKLE] = { x: 0.5, y: 0.95, z: 0, visibility: 1 };
  lm[LM.RIGHT_ANKLE] = { x: 0.5, y: 0.95, z: 0, visibility: 1 };
  return { t: 0, lm, quality: 1 };
}

test('live: upright squat frame has no compensation', () => {
  const m = liveActivation('squat', frame(0));
  assert.equal(m.lowerBack, undefined);
  assert.equal(m.quads?.state, 'primary');
});

test('live: heavy forward-lean squat frame lights lower back red', () => {
  const m = liveActivation('squat', frame(0.32));
  assert.equal(m.lowerBack?.state, 'compensating');
});
