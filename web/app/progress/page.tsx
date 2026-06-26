'use client';

import { useEffect, useState } from 'react';
import { getSessions, type SessionRecord } from '@/lib/db';
import { getExercise } from '@/lib/analysis/exercises';
import { BottomNav } from '@/components/BottomNav';

function Trend({ sessions }: { sessions: SessionRecord[] }) {
  // oldest -> newest form score sparkline
  const data = [...sessions].reverse();
  if (data.length < 2) return <p className="muted">Log at least two sets to see a trend.</p>;
  const W = 600;
  const H = 120;
  const pad = 10;
  const xs = data.map((_, i) => pad + (i * (W - 2 * pad)) / (data.length - 1));
  const ys = data.map((s) => H - pad - (s.overallScore / 100) * (H - 2 * pad));
  const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--border)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={3} fill="var(--accent-2)" />
      ))}
    </svg>
  );
}

export default function Progress() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  useEffect(() => setSessions(getSessions()), []);

  const byExercise = sessions.reduce<Record<string, SessionRecord[]>>((acc, s) => {
    (acc[s.exercise] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="container">
      <div className="brand" style={{ marginBottom: 16 }}>
        <span className="dot" /> Progress
      </div>

      {sessions.length === 0 ? (
        <div className="panel">
          <p className="muted">No workouts logged yet. Analyze a set and it will appear here.</p>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="label">Form score over time ({sessions.length} sets)</div>
            <Trend sessions={sessions} />
          </div>

          {Object.entries(byExercise).map(([name, recs]) => {
            const ex = getExercise(name);
            const avg = Math.round(recs.reduce((s, r) => s + r.overallScore, 0) / recs.length);
            const totalReps = recs.reduce((s, r) => s + r.repCount, 0);
            return (
              <div className="panel" key={name}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{ex?.label ?? name}</strong>
                  <span className="muted">
                    {recs.length} sets · {totalReps} reps · avg {avg}/100
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  {recs[0].muscleGroups.join(' · ')}
                  {recs.find((r) => r.topIssue) ? ` · most common: ${mostCommonIssue(recs)}` : ''}
                </div>
              </div>
            );
          })}
        </>
      )}

      <BottomNav />
    </div>
  );
}

function mostCommonIssue(recs: SessionRecord[]): string {
  const counts = new Map<string, number>();
  for (const r of recs) if (r.topIssue) counts.set(r.topIssue, (counts.get(r.topIssue) ?? 0) + 1);
  let best = '';
  let n = 0;
  for (const [k, v] of counts) if (v > n) { n = v; best = k; }
  return best;
}
