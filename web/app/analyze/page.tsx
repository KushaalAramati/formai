'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getLandmarker } from '@/lib/pose/landmarker';
import { drawSkeleton, type FormState } from '@/lib/pose/skeleton';
import { frameQuality } from '@/lib/analysis/quality';
import { checkFraming, estimateBrightness, type FramingResult } from '@/lib/analysis/framing';
import { countReps } from '@/lib/analysis/repCounter';
import { analyzeSet } from '@/lib/analysis/engine';
import { getExercise } from '@/lib/analysis/exercises';
import { setResult } from '@/lib/store';
import { SnapshotBuffer } from '@/lib/pose/frameCapture';
import { cue } from '@/lib/feedback/channels';
import { getSettings } from '@/lib/db';
import type { FrameSample, Landmark } from '@/lib/analysis/types';

const FEET_EXERCISES = new Set(['squat', 'deadlift', 'rdl', 'lunge']);

function AnalyzeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const exName = params.get('ex') || 'squat';
  const mode = (params.get('mode') as 'upload' | 'live') || 'upload';
  const ex = getExercise(exName);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef<FrameSample[]>([]);
  const capturingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(-1);
  const snapRef = useRef(new SnapshotBuffer());
  const sinceSnapRef = useRef(0);
  const lastFramingRef = useRef(0);
  const requireFeet = !!ex && FEET_EXERCISES.has(ex.name);

  const [framing, setFraming] = useState<FramingResult | null>(null);

  const [status, setStatus] = useState('Loading pose model…');
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [liveReps, setLiveReps] = useState(0);
  const [formState, setFormState] = useState<FormState>('idle');
  const [hasVideo, setHasVideo] = useState(false);

  // Load model on mount.
  useEffect(() => {
    let cancelled = false;
    getLandmarker()
      .then(() => {
        if (cancelled) return;
        setReady(true);
        setStatus(mode === 'live' ? 'Camera starting…' : 'Choose a video to analyze.');
        if (mode === 'live') startCamera();
      })
      .catch((e) => setStatus('Failed to load pose model: ' + e.message));
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const v = videoRef.current;
      if (v?.srcObject) (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const v = videoRef.current!;
      v.srcObject = stream;
      v.muted = true;
      await v.play();
      setHasVideo(true);
      setStatus('Camera ready. Press “Start recording”, do your set, then “Stop”.');
      loop();
    } catch (e: any) {
      setStatus('Camera access denied or unavailable: ' + e.message);
    }
  }, []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const v = videoRef.current!;
    v.srcObject = null;
    v.src = URL.createObjectURL(file);
    v.muted = true;
    setHasVideo(true);
    samplesRef.current = [];
    lastTsRef.current = -1;
    setLiveReps(0);
    setStatus('Press play to analyze the video.');
    v.onloadeddata = () => sizeCanvas();
  }

  function sizeCanvas() {
    const v = videoRef.current!;
    const c = canvasRef.current!;
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
  }

  const toLandmarks = (raw: any[]): Landmark[] =>
    raw.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0, visibility: p.visibility ?? 0 }));

  // Main detection loop (used for both live and during upload playback).
  const loop = useCallback(async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !ex) return;
    const lmk = await getLandmarker();

    const tick = async () => {
      if (!v || v.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (c.width !== v.videoWidth && v.videoWidth) sizeCanvas();

      const tsMs = performance.now();
      if (tsMs > lastTsRef.current) {
        lastTsRef.current = tsMs;
        const res = lmk.detectForVideo(v, tsMs);
        const ctx = c.getContext('2d')!;
        if (res.landmarks && res.landmarks.length) {
          const lm = toLandmarks(res.landmarks[0]);
          const quality = frameQuality(lm, ex.trackedJoints);

          // live form tint: green if good quality, amber if marginal, red if low.
          const fs: FormState = quality > 0.7 ? 'good' : quality > 0.45 ? 'warn' : 'bad';
          setFormStateThrottled(fs);
          drawSkeleton(ctx, lm, c.width, c.height, capturingRef.current ? fs : 'idle');

          if (capturingRef.current) {
            const t =
              mode === 'upload' ? v.currentTime : samplesRef.current.length === 0
                ? 0
                : (tsMs - startTsRef.current) / 1000;
            samplesRef.current.push({ t, lm, quality });
            // capture a downscaled key-frame snapshot roughly every 4th processed frame
            if (++sinceSnapRef.current >= 4) {
              sinceSnapRef.current = 0;
              snapRef.current.capture(v, t);
            }
            // cheap provisional rep count
            if (samplesRef.current.length % 8 === 0 && !ex.isHold) {
              setLiveReps(countReps(ex, samplesRef.current).length);
            }
          } else if (mode === 'live') {
            // Pre-recording: run the camera-setup check ~2x/sec and nudge the user.
            if (tsMs - lastFramingRef.current > 500) {
              lastFramingRef.current = tsMs;
              const brightness = estimateBrightness(v);
              const fr = checkFraming(lm, brightness, requireFeet);
              setFraming(fr);
              if (!fr.ok && fr.message) cue(getSettings(), fr.message);
            }
          }
        } else {
          ctx.clearRect(0, 0, c.width, c.height);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [ex, mode]);

  const startTsRef = useRef(0);
  const formThrottleRef = useRef(0);
  function setFormStateThrottled(fs: FormState) {
    const now = performance.now();
    if (now - formThrottleRef.current > 200) {
      formThrottleRef.current = now;
      setFormState(fs);
    }
  }

  // Upload: start capture when the video plays; analyze when it ends.
  function onPlayUpload() {
    if (mode !== 'upload') return;
    samplesRef.current = [];
    snapRef.current = new SnapshotBuffer();
    setLiveReps(0);
    capturingRef.current = true;
    setCapturing(true);
    lastTsRef.current = -1;
    setStatus('Analyzing… let the video play to the end.');
    loop();
  }

  function onEndedUpload() {
    if (mode !== 'upload') return;
    capturingRef.current = false;
    setCapturing(false);
    finish();
  }

  // Live: explicit start/stop.
  function startRecording() {
    samplesRef.current = [];
    snapRef.current = new SnapshotBuffer();
    setLiveReps(0);
    setFraming(null);
    startTsRef.current = performance.now();
    capturingRef.current = true;
    setCapturing(true);
    setStatus('Recording… do your set.');
  }
  function stopRecording() {
    capturingRef.current = false;
    setCapturing(false);
    finish();
  }

  function finish() {
    if (!ex) return;
    const samples = samplesRef.current;
    if (samples.length < 5) {
      setStatus('Not enough was captured to analyze. Try again with your full body in frame.');
      return;
    }
    setStatus('Crunching the numbers…');
    const result = analyzeSet(ex, samples);
    setResult({ result, samples, exerciseName: ex.name, snapshots: snapRef.current.all() });
    router.push('/dashboard');
  }

  if (!ex) return <div className="container">Unknown exercise.</div>;

  return (
    <div className="container">
      <div className="brand" style={{ marginBottom: 16 }}>
        <span className="dot" /> FormAI · {ex.label}
      </div>

      <div className="panel">
        <div className="stage">
          <video
            ref={videoRef}
            playsInline
            controls={mode === 'upload'}
            onPlay={onPlayUpload}
            onEnded={onEndedUpload}
          />
          <canvas ref={canvasRef} />
          <div className="hud">
            <div className="badge">
              <div className="muted" style={{ fontSize: 11 }}>
                {ex.isHold ? 'HOLD' : 'REPS'}
              </div>
              <div className="repcount">{ex.isHold ? (capturing ? '●' : '–') : liveReps}</div>
            </div>
            <div className="badge" style={{ alignSelf: 'flex-start' }}>
              {formState === 'good'
                ? '✅ Tracking'
                : formState === 'warn'
                  ? '⚠️ Partial'
                  : formState === 'bad'
                    ? '❌ Body not visible'
                    : 'Ready'}
            </div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          {status}
        </p>

        {mode === 'upload' && (
          <input type="file" accept="video/*" onChange={onFile} disabled={!ready} style={{ marginTop: 8 }} />
        )}

        {mode === 'live' && hasVideo && !capturing && framing && (
          <div
            className={framing.ok ? 'panel' : 'warn-box'}
            style={{ marginTop: 12, marginBottom: 0 }}
          >
            <strong>{framing.ok ? '✅ Camera setup looks good' : '📐 Fix your setup'}</strong>
            {!framing.ok && framing.message && <div style={{ marginTop: 4 }}>{framing.message}</div>}
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Body {framing.jointsVisible ? '✓' : '✕'} · Feet{' '}
              {requireFeet ? (framing.feetVisible ? '✓' : '✕') : 'n/a'} · Centered{' '}
              {framing.centered ? '✓' : '✕'} · Lighting {framing.lightingOk ? '✓' : '✕'}
            </div>
          </div>
        )}

        {mode === 'live' && hasVideo && (
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {!capturing ? (
              <button className="btn" onClick={startRecording} disabled={!ready}>
                ● Start recording
              </button>
            ) : (
              <button className="btn" onClick={stopRecording} style={{ background: 'var(--bad)' }}>
                ■ Stop & analyze
              </button>
            )}
          </div>
        )}
      </div>

      <button className="btn secondary" onClick={() => router.push('/')}>
        ← Back
      </button>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="container">Loading…</div>}>
      <AnalyzeInner />
    </Suspense>
  );
}
