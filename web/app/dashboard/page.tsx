'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getResult } from '@/lib/store';
import { getExercise } from '@/lib/analysis/exercises';
import { QUESTIONS, recommend, type Recommendation } from '@/lib/questions';
import { KeyFrame } from '@/components/KeyFrame';
import { addSession, lastWeightFor } from '@/lib/db';
import type { FrameSample, SetResult, UserContext } from '@/lib/analysis/types';
import type { Snapshot } from '@/lib/pose/frameCapture';

const LABEL_TEXT: Record<string, string> = { good: 'Good', minor: 'Minor issue', poor: 'Poor' };

function scoreColor(s: number) {
  if (s >= 80) return 'var(--accent-2)';
  if (s >= 60) return 'var(--warn)';
  return 'var(--bad)';
}

export default function Dashboard() {
  const router = useRouter();
  const [stored, setStored] = useState<{
    result: SetResult;
    exerciseName: string;
    samples: FrameSample[];
    snapshots: Snapshot[];
  } | null>(null);
  const [ctx, setCtx] = useState<UserContext>({});
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [weight, setWeight] = useState<string>('');
  const savedRef = useRef(false);

  useEffect(() => {
    const s = getResult();
    if (!s) {
      router.replace('/');
      return;
    }
    setStored(s);
    const lw = lastWeightFor(s.exerciseName);
    if (lw != null) setWeight(String(lw));
    // Persist this set to the on-device progress log (once).
    if (!savedRef.current) {
      savedRef.current = true;
      addSession({
        id: `${s.exerciseName}-${Math.round(s.result.confidence * 1000)}-${s.result.repCount}-${s.samples.length}`,
        date: Date.now(),
        exercise: s.exerciseName,
        muscleGroups: s.result.muscleGroups,
        repCount: s.result.repCount,
        holdSeconds: s.result.holdSeconds,
        overallScore: s.result.overallScore,
        confidence: s.result.confidence,
        topIssue: s.result.issues[0]?.name,
      });
    }
  }, [router]);

  const ex = stored ? getExercise(stored.exerciseName) : undefined;
  const r = stored?.result;

  const reps = useMemo(() => r?.reps ?? [], [r]);

  /** Find the captured frame + landmarks for a given rep number (best/worst key frame). */
  function keyFrameFor(repNumber: number | null) {
    if (!repNumber || !stored) return { url: null as string | null, lm: null as any };
    const rep = stored.result.reps.find((x) => x.repNumber === repNumber);
    if (!rep) return { url: null, lm: null };
    const sample = rep.samples[Math.min(rep.keyFrameIndex, rep.samples.length - 1)];
    let nearest: Snapshot | null = null;
    let bestD = Infinity;
    for (const sn of stored.snapshots) {
      const d = Math.abs(sn.t - sample.t);
      if (d < bestD) {
        bestD = d;
        nearest = sn;
      }
    }
    return { url: nearest?.url ?? null, lm: sample.lm };
  }

  if (!r || !ex) return <div className="container">Loading results…</div>;

  function update<K extends keyof UserContext>(k: K, v: UserContext[K]) {
    setCtx((c) => ({ ...c, [k]: v }));
  }
  function toggleEquip(v: string) {
    setCtx((c) => {
      const set = new Set(c.equipment ?? []);
      set.has(v as any) ? set.delete(v as any) : set.add(v as any);
      return { ...c, equipment: Array.from(set) as any };
    });
  }

  return (
    <div className="container">
      <div className="brand" style={{ marginBottom: 16 }}>
        <span className="dot" /> Results · {ex.label}
      </div>

      {r.uncertain && (
        <div className="warn-box">
          ⚠️ <strong>Analysis uncertain.</strong> Capture quality or body visibility was low
          (confidence {Math.round(r.confidence * 100)}%). Treat these numbers as a rough guide and
          re-record from the {ex.requiredCameraAngle} with your full body in frame for better
          results.
        </div>
      )}
      {r.warnings.map((w, i) => (
        <div className="warn-box" key={i}>
          {w}
        </div>
      ))}

      {/* Score gauge */}
      <div className="panel gauge">
        <div
          className="score-num"
          style={{ color: scoreColor(r.overallScore) }}
        >
          {r.overallScore}
          <span style={{ fontSize: 18, color: 'var(--muted)' }}>/100</span>
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>
            {ex.isHold ? `${r.holdSeconds}s hold` : `${r.repCount} reps detected`}
          </div>
          <div className="muted" style={{ fontSize: 14 }}>
            {r.muscleGroups.join(' · ')}
            {r.bestRep ? ` · Best rep ${r.bestRep}` : ''}
            {r.worstRep && r.worstRep !== r.bestRep ? ` · Worst rep ${r.worstRep}` : ''}
          </div>
        </div>
      </div>

      {/* Confidence breakdown — trust the user can see */}
      <div className="panel">
        <div className="label">Analysis confidence: {Math.round(r.confidence * 100)}%</div>
        <div className="grid cols-3" style={{ fontSize: 14 }}>
          {(
            [
              ['Full body visible', r.confidenceBreakdown.fullBodyVisible],
              ['Feet visible', r.confidenceBreakdown.feetVisible],
              ['Major joints', r.confidenceBreakdown.jointsVisible],
              ['Centered', r.confidenceBreakdown.centered],
              ['Lighting', r.confidenceBreakdown.lightingOk],
              ['Pose tracking', r.confidenceBreakdown.trackingOk],
            ] as [string, boolean][]
          ).map(([k, v]) => (
            <div key={k}>
              {v ? '✅' : '⚠️'} {k}
            </div>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Exercise: {ex.label} (manually selected)
        </div>
      </div>

      {/* Weight log */}
      {!ex.isHold && (
        <div className="panel">
          <div className="label">Weight used (optional)</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              value={weight}
              placeholder="e.g. 20"
              onChange={(e) => setWeight(e.target.value)}
              style={{ maxWidth: 140 }}
            />
            <span className="muted">kg · feeds your progress log & next-session advice</span>
          </div>
        </div>
      )}

      {/* Per-rep bar */}
      {reps.length > 0 && (
        <div className="panel">
          <div className="label">Rep-by-rep score</div>
          <div className="repbar">
            {reps.map((rep) => (
              <div
                className="r"
                key={rep.repNumber}
                style={{ borderColor: scoreColor(rep.score) }}
                title={Object.entries(rep.angles)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ')}
              >
                <div className="n">Rep {rep.repNumber}</div>
                <div className="s" style={{ color: scoreColor(rep.score) }}>
                  {rep.score}
                </div>
                <div className="n" style={{ color: scoreColor(rep.score) }}>
                  {LABEL_TEXT[rep.label]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best / worst key frames with skeleton overlay */}
      {(r.bestRep || r.worstRep) && (
        <div className="panel">
          <div className="label">Key frames</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {r.bestRep && (
              <KeyFrame
                url={keyFrameFor(r.bestRep).url}
                landmarks={keyFrameFor(r.bestRep).lm}
                state="good"
                caption={`Best · Rep ${r.bestRep}`}
              />
            )}
            {r.worstRep && r.worstRep !== r.bestRep && (
              <KeyFrame
                url={keyFrameFor(r.worstRep).url}
                landmarks={keyFrameFor(r.worstRep).lm}
                state={r.issues.some((i) => i.affectedReps.includes(r.worstRep!) && i.severity === 'major') ? 'bad' : 'warn'}
                caption={`Worst · Rep ${r.worstRep}`}
              />
            )}
          </div>
        </div>
      )}

      {/* Issues */}
      <div className="panel">
        <div className="label">Detected issues & fixes</div>
        {r.issues.length === 0 ? (
          <p className="muted">No form issues detected. Nice work.</p>
        ) : (
          r.issues.map((iss, i) => (
            <div className="issue" key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <strong>{iss.name}</strong>
                <span className={`sev ${iss.severity}`}>{iss.severity}</span>
              </div>
              {iss.affectedReps.length > 0 && (
                <div className="muted" style={{ fontSize: 13, margin: '4px 0' }}>
                  Reps: {iss.affectedReps.join(', ')}
                </div>
              )}
              <div style={{ fontSize: 14, margin: '6px 0' }}>{iss.why}</div>
              <div style={{ fontSize: 14, color: 'var(--accent)' }}>💡 {iss.fix}</div>
            </div>
          ))
        )}
      </div>

      {/* Coaching summary */}
      <div className="panel">
        <div className="label">Coaching summary</div>
        <div className="summary">{r.summary}</div>
      </div>

      {/* Follow-up */}
      <div className="panel">
        <div className="label">A few questions to personalize your next step</div>
        {QUESTIONS.map((q) => (
          <div key={q.id}>
            <label className="q">{q.label}</label>
            {q.type === 'bool' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`chip ${ctx[q.id] === true ? 'active' : ''}`}
                  onClick={() => update(q.id as any, true as any)}
                >
                  Yes
                </button>
                <button
                  className={`chip ${ctx[q.id] === false ? 'active' : ''}`}
                  onClick={() => update(q.id as any, false as any)}
                >
                  No
                </button>
              </div>
            )}
            {q.type === 'text' && (
              <input
                type="text"
                onChange={(e) => update(q.id as any, e.target.value as any)}
              />
            )}
            {q.type === 'scale' && (
              <input
                type="number"
                min={1}
                max={10}
                onChange={(e) => update(q.id as any, Number(e.target.value) as any)}
              />
            )}
            {q.type === 'choice' && (
              <select onChange={(e) => update(q.id as any, e.target.value as any)} defaultValue="">
                <option value="" disabled>
                  Select…
                </option>
                {q.options!.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {q.type === 'multi' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {q.options!.map((o) => (
                  <button
                    key={o.value}
                    className={`chip ${ctx.equipment?.includes(o.value as any) ? 'active' : ''}`}
                    onClick={() => toggleEquip(o.value)}
                    style={{ flex: '0 0 auto' }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <button
          className="btn"
          style={{ marginTop: 18 }}
          onClick={() => setRec(recommend(r, ctx))}
        >
          Get my recommendation →
        </button>
      </div>

      {rec && (
        <div className={rec.redFlag ? 'danger-box' : 'panel'}>
          <div className="label">{rec.redFlag ? '🚑 Safety first' : '✅ Recommendation'}</div>
          <h3 style={{ margin: '4px 0 8px' }}>{rec.headline}</h3>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{rec.detail}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn secondary" onClick={() => router.push('/')}>
          ← Analyze another set
        </button>
      </div>
    </div>
  );
}
