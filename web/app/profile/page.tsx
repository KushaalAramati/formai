'use client';

import { useEffect, useState } from 'react';
import { getProfile, saveProfile, type Profile } from '@/lib/db';
import { BottomNav } from '@/components/BottomNav';

const EQUIP = ['bodyweight', 'dumbbells', 'barbell', 'machines'] as const;

export default function ProfilePage() {
  const [p, setP] = useState<Profile>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => setP(getProfile()), []);

  function set<K extends keyof Profile>(k: K, v: Profile[K]) {
    setP((cur) => ({ ...cur, [k]: v }));
    setSaved(false);
  }
  function toggleEquip(v: (typeof EQUIP)[number]) {
    setP((cur) => {
      const s = new Set(cur.equipment ?? []);
      s.has(v) ? s.delete(v) : s.add(v);
      return { ...cur, equipment: Array.from(s) };
    });
    setSaved(false);
  }
  function save() {
    saveProfile(p);
    setSaved(true);
  }

  return (
    <div className="container">
      <div className="brand" style={{ marginBottom: 16 }}>
        <span className="dot" /> Your profile
      </div>

      <div className="panel">
        <label className="q">Name</label>
        <input type="text" value={p.name ?? ''} onChange={(e) => set('name', e.target.value)} />

        <div className="grid cols-2">
          <div>
            <label className="q">Age</label>
            <input type="number" value={p.age ?? ''} onChange={(e) => set('age', Number(e.target.value))} />
          </div>
          <div>
            <label className="q">Gender</label>
            <select value={p.gender ?? ''} onChange={(e) => set('gender', e.target.value as any)}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="q">Height (cm)</label>
            <input type="number" value={p.heightCm ?? ''} onChange={(e) => set('heightCm', Number(e.target.value))} />
          </div>
          <div>
            <label className="q">Weight (kg)</label>
            <input type="number" value={p.weightKg ?? ''} onChange={(e) => set('weightKg', Number(e.target.value))} />
          </div>
        </div>

        <label className="q">Main goal</label>
        <select value={p.goal ?? ''} onChange={(e) => set('goal', e.target.value as any)}>
          <option value="">—</option>
          <option value="strength">Strength</option>
          <option value="muscle">Build muscle</option>
          <option value="fatloss">Fat loss</option>
          <option value="general">General fitness</option>
        </select>

        <label className="q">Experience level</label>
        <select value={p.level ?? ''} onChange={(e) => set('level', e.target.value as any)}>
          <option value="">—</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        <label className="q">Equipment access</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EQUIP.map((v) => (
            <button
              key={v}
              className={`chip ${p.equipment?.includes(v) ? 'active' : ''}`}
              style={{ flex: '0 0 auto', textTransform: 'capitalize' }}
              onClick={() => toggleEquip(v)}
            >
              {v}
            </button>
          ))}
        </div>

        <label className="q">Injuries or limitations (optional)</label>
        <input type="text" value={p.injuries ?? ''} onChange={(e) => set('injuries', e.target.value)} />

        <button className="btn" style={{ marginTop: 18 }} onClick={save}>
          {saved ? '✓ Saved' : 'Save profile'}
        </button>
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          Stored only on this device. Beginners get simpler, safer feedback; advanced users get more
          detail.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
