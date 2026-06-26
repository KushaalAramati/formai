'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSettings, saveSettings } from '@/lib/db';
import { cue, type FeedbackMode, type FeedbackSettings } from '@/lib/feedback/channels';
import { BottomNav } from '@/components/BottomNav';

const MODES: { value: FeedbackMode; label: string; desc: string }[] = [
  { value: 'silent', label: '🔇 Silent', desc: 'No cues at all.' },
  { value: 'visual', label: '👁️ Visual', desc: 'On-screen only (default). Never makes a sound.' },
  { value: 'haptic', label: '📳 Haptic', desc: 'Phone vibrates for alerts. No sound.' },
  { value: 'voice', label: '🗣️ Voice', desc: 'Spoken cues. Mixes with your music — never stops it.' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [s, setS] = useState<FeedbackSettings>({ mode: 'visual', units: 'kg' });

  useEffect(() => setS(getSettings()), []);

  function update(next: Partial<FeedbackSettings>) {
    const merged = { ...s, ...next };
    setS(merged);
    saveSettings(merged);
    if (next.mode && next.mode !== 'silent' && next.mode !== 'visual') cue(merged, 'Feedback test');
  }

  return (
    <div className="container">
      <div className="brand" style={{ marginBottom: 16 }}>
        <span className="dot" /> Settings
      </div>

      <div className="panel">
        <div className="label">Feedback style</div>
        <div className="grid cols-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              className={`chip ${s.mode === m.value ? 'active' : ''}`}
              style={{ flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}
              onClick={() => update({ mode: m.value })}
            >
              <span>{m.label}</span>
              <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
                {m.desc}
              </span>
            </button>
          ))}
        </div>
        <div className="warn-box" style={{ marginTop: 14 }}>
          🎵 FormAI never interrupts your music. Visual and haptic cues make no sound at all; voice
          cues mix with your audio rather than stopping Spotify, Apple Music, or YouTube.
        </div>
      </div>

      <div className="panel">
        <div className="label">Units</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['kg', 'lbs'] as const).map((u) => (
            <button
              key={u}
              className={`chip ${s.units === u ? 'active' : ''}`}
              onClick={() => update({ units: u })}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <button className="btn secondary" onClick={() => router.push('/')} style={{ width: '100%' }}>
        Done
      </button>

      <BottomNav />
    </div>
  );
}
