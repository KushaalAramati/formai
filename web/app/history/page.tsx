'use client';

import { useEffect, useState } from 'react';
import { getSessions, type SessionRecord } from '@/lib/db';
import { getExercise } from '@/lib/analysis/exercises';
import { BottomNav } from '@/components/BottomNav';

function scoreColor(s: number) {
  if (s >= 80) return 'var(--accent)';
  if (s >= 60) return 'var(--warn)';
  return 'var(--bad)';
}

function when(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function History() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  useEffect(() => setSessions(getSessions()), []);

  return (
    <div className="container">
      <div className="brand" style={{ marginBottom: 18 }}>
        <span className="dot" /> History
      </div>

      {sessions.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            No sessions yet. Analyze a set and it will show up here.
          </p>
        </div>
      ) : (
        <div className="panel">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sessions.map((s, i) => {
              const ex = getExercise(s.exercise);
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '13px 2px',
                    borderBottom: i < sessions.length - 1 ? '1px solid var(--line)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{ex?.label ?? s.exercise}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {when(s.date)} · {s.holdSeconds ? `${s.holdSeconds}s hold` : `${s.repCount} reps`}
                    </div>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 500, color: scoreColor(s.overallScore) }}>
                    {s.overallScore}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
