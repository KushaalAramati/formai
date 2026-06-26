'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { repActivation, setActivation, type ActivationMap } from '@/lib/anatomy/activation';
import type { Rep, SetResult } from '@/lib/analysis/types';

const AnatomyViewer = dynamic(() => import('./AnatomyViewer'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 320,
        borderRadius: 16,
        background: '#0c1118',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8a9099',
        fontSize: 13,
      }}
    >
      Loading 3D model…
    </div>
  ),
});

const LEGEND: { color: string; label: string }[] = [
  { color: '#16a34a', label: 'On target' },
  { color: '#0d9488', label: 'Assisting' },
  { color: '#f59e0b', label: 'Under-worked' },
  { color: '#ef4444', label: 'Compensating' },
];

function pseudoRep(result: SetResult): Rep {
  return {
    repNumber: 0,
    startT: 0,
    endT: 0,
    samples: [],
    angles: {},
    issues: result.issues,
    score: result.overallScore,
    label: 'good',
    keyFrameIndex: 0,
  };
}

export function MuscleMap({ result }: { result: SetResult }) {
  const reps = result.reps;
  const worst = result.worstRep ?? (reps[0]?.repNumber ?? null);
  const [sel, setSel] = useState<number | 'set'>(worst ?? 'set');

  const activation: ActivationMap = useMemo(() => {
    if (reps.length === 0) return repActivation(result.exercise, pseudoRep(result));
    if (sel === 'set') return setActivation(result.exercise, reps);
    const rep = reps.find((r) => r.repNumber === sel) ?? reps[0];
    return repActivation(result.exercise, rep);
  }, [result, reps, sel]);

  return (
    <div className="panel">
      <div className="label">Muscle map · which muscles this set worked</div>

      <AnatomyViewer activation={activation} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, margin: '12px 2px 0' }}>
        {LEGEND.map((l) => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: l.color }} />
            <span className="muted">{l.label}</span>
          </span>
        ))}
      </div>

      {reps.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          <button
            className={`chip ${sel === 'set' ? 'active' : ''}`}
            style={{ flex: '0 0 auto', padding: '7px 12px', fontSize: 13 }}
            onClick={() => setSel('set')}
          >
            Whole set
          </button>
          {reps.map((r) => (
            <button
              key={r.repNumber}
              className={`chip ${sel === r.repNumber ? 'active' : ''}`}
              style={{ flex: '0 0 auto', padding: '7px 12px', fontSize: 13 }}
              onClick={() => setSel(r.repNumber)}
            >
              Rep {r.repNumber}
            </button>
          ))}
        </div>
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Inferred from your form — not a muscle-activity measurement. Green = the muscles this
        exercise targets; red = a muscle a detected fault made you over-use; amber = a target you
        under-worked.
      </p>
    </div>
  );
}
