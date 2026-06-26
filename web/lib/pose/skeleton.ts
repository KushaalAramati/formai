// Draw the pose skeleton onto a canvas overlay, color-coded by live form state.
import type { Landmark } from '../analysis/types';
import { SKELETON_BONES } from './landmarks';

export type FormState = 'good' | 'warn' | 'bad' | 'idle';

const COLORS: Record<FormState, string> = {
  good: '#22c55e',
  warn: '#f59e0b',
  bad: '#ef4444',
  idle: '#38bdf8',
};

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: Landmark[],
  w: number,
  h: number,
  state: FormState = 'idle'
) {
  ctx.clearRect(0, 0, w, h);
  if (!lm || lm.length < 33) return;
  const color = COLORS[state];

  // Bones
  ctx.lineWidth = Math.max(2, w * 0.005);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (const [a, b] of SKELETON_BONES) {
    const pa = lm[a];
    const pb = lm[b];
    if (!pa || !pb || pa.visibility < 0.4 || pb.visibility < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }

  // Joints
  const r = Math.max(3, w * 0.007);
  ctx.fillStyle = '#ffffff';
  for (const p of lm) {
    if (!p || p.visibility < 0.4) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export { COLORS };
