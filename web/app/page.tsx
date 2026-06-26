'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EXERCISE_LIST } from '@/lib/analysis/exercises';
import { BottomNav } from '@/components/BottomNav';

export default function Home() {
  const router = useRouter();
  const [exercise, setExercise] = useState('squat');
  const [mode, setMode] = useState<'upload' | 'live'>('upload');

  const selected = EXERCISE_LIST.find((e) => e.name === exercise)!;
  const angleHint =
    selected.requiredCameraAngle === 'front'
      ? 'Record from the FRONT (camera facing you).'
      : 'Record from the SIDE (camera to your side).';

  function start() {
    router.push(`/analyze?ex=${exercise}&mode=${mode}`);
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="brand">
          <span className="dot" /> FormAI
        </div>
        <button
          className="navitem"
          style={{ color: 'var(--muted)' }}
          aria-label="Settings"
          onClick={() => router.push('/settings')}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>
      <p className="tagline">Track form. Improve every rep.</p>

      <div className="panel">
        <div className="label">1 · Choose an exercise</div>
        <div className="grid cols-3">
          {EXERCISE_LIST.map((e) => (
            <button
              key={e.name}
              className={`chip ${exercise === e.name ? 'active' : ''}`}
              onClick={() => setExercise(e.name)}
            >
              {e.label}
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
          📐 {angleHint} Keep your whole body in frame.
        </p>
      </div>

      <div className="panel">
        <div className="label">2 · Capture method</div>
        <div className="grid cols-2">
          <button
            className={`chip ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => setMode('upload')}
          >
            ⬆️ Upload a video
          </button>
          <button
            className={`chip ${mode === 'live' ? 'active' : ''}`}
            onClick={() => setMode('live')}
          >
            🎥 Use live camera
          </button>
        </div>
      </div>

      <button className="btn" onClick={start} style={{ width: '100%' }}>
        Start analysis
      </button>

      <p className="muted" style={{ marginTop: 18, fontSize: 13 }}>
        Everything runs in your browser — your video never leaves your device. This is automated
        form feedback, not medical advice.
      </p>

      <BottomNav />
    </div>
  );
}
