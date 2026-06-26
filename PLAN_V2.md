# GymAI v2 — AI Gym Coach: Full Implementation Plan

> "Place your phone, start a session, and let the app watch the whole workout — recognizing
> exercises, checking form, counting reps, logging sets, and summarizing it all at the end."

This is the startup-grade plan. It supersedes `IMPLEMENTATION_PLAN.md` (the v1 MVP) and tells you
exactly what is **built today**, what is **next**, and how every hard piece works. The guiding
rule the spec demands: **accuracy, user trust, simple UX, and useful feedback over feature count.**

Legend: ✅ built in `web/` · 🟡 partially built · ⬜ planned.

---

## 1. Product Overview

GymAI is an AI gym coach that watches a lifter through their phone camera (live or uploaded
video), runs an on-device pose → rules pipeline, and returns trustworthy, specific feedback:
per-rep scoring, exercise recognition, set logging, a session summary, and progress over time.

Trust is the product. We earn it three ways:
1. **Rules-first, LLM-second** — every judgment is deterministic; the LLM only rephrases.
2. **Confidence on everything** — we show how sure we are and *why*, and say "uncertain" loudly.
3. **No medical claims** — we coach form, we never diagnose; red flags route to a professional.

Privacy and audio are first-class: pose runs **on-device** (video never leaves the phone in the
MVP), and the app **never takes over audio** — your music keeps playing; alerts are silent/visual
by default, with optional haptics or voice you control.

---

## 2. Core User Journey

```
Onboard ─► Profile (age, goal, level, equipment, units, feedback style)
   │
   ▼
Start session ─► Camera-setup check (full body? feet? lighting? centered?) ──fix──┐
   │                                                                              │
   ▼  (framing OK, confidence shown)                                             ◄┘
Live session ─► [auto] recognize exercise ─► count reps ─► score each rep ─► log set
   │              (silent visual HUD; optional haptic/voice; music untouched)
   │  rest detected ─► set boundary ─► next exercise …
   ▼
End session ─► Session summary (exercises, sets, reps, weights, form, best/worst, mistakes,
   │            improvements, next-workout recommendation) + key frames (screenshots)
   ▼
Progress tracker updates (history, trends, PRs, recurring mistakes, ROM/consistency)
```

Two entry modes share the same pipeline: **Single-set analyze** (upload or quick live) and **Session
mode** (continuous). The MVP ships single-set; session mode is the layer above it.

---

## 3. MVP Feature List (realistic first cut)

- ✅ Upload **or** live-camera single-set analysis, 6 exercises (squat, push-up, curl, shoulder
  press, lateral raise, plank).
- ✅ On-device pose estimation + live skeleton overlay; video never leaves device.
- ✅ Rep counting (hysteresis FSM) + per-rep angles, depth, tempo, symmetry, ROM.
- ✅ Exercise-specific form rule engines → issues (severity, affected reps, why, fix).
- ✅ 0–100 set score, per-rep scores, best/worst rep.
- ✅ Follow-up questionnaire → rule-based recommendation with **safety red-flag override**.
- ✅ Deterministic coaching text; optional LLM rephrasing (`/api/coach`, can't invent faults).
- ✅ **Confidence breakdown** (full body / feet / lighting / centering / tracking) + "uncertain".
- ✅ **Camera-setup check** before live capture with specific fix messages.
- ✅ **Per-rep qualitative labels** (Good / Minor issue / Poor) used in the summary.
- ✅ **Key-frame screenshots** of best & worst reps with skeleton overlay.
- ✅ **Feedback settings**: silent (default) / visual / haptic / voice — never interrupts music.
- ✅ **Local progress tracker + profile** (history, form-score trend, weight log) via on-device storage.

What the MVP deliberately does **not** do yet (and why): automatic multi-exercise recognition and
full hands-off session mode (need a trained classifier + robust rest detection — Phase 4–5);
automatic weight recognition from the bar (hard CV — manual/estimated for now); cloud sync &
accounts (privacy-first local storage first).

---

## 4. Full Feature List (target product)

Form checker (per-rep scoring, all metrics) · Session mode (continuous, auto set/exercise
segmentation, end-of-session summary) · Exercise recognition incl. variations & muscle groups ·
Camera-setup & framing assistant · Confidence/uncertainty on every analysis · Key-frame
screenshots & before/after comparison · Weight recognition/entry/estimation & logging ·
Recommendations engine · Progress tracker (graphs, weekly/monthly, per-exercise, per-muscle,
before/after photos) · User profile & personalization · Audio-safe multi-modal feedback
(silent/visual/haptic/voice/earpiece) · Cloud sync + accounts · Social/sharing (later).

---

## 5. System Architecture

```
┌───────────────────────── Mobile app / PWA (on-device) ─────────────────────────┐
│ Camera / file ─► Pose (MediaPipe / MoveNet / Apple Vision) ─► landmarks[33]/frame│
│        │                                   │                                     │
│        ▼                                    ▼                                     │
│  Skeleton overlay              ┌── Analysis engine (pure TS, framework-free) ──┐  │
│  + key-frame capture           │ framing → recognizer → repCounter → angles →  │  │
│                                │ form rules → rep/set scoring → confidence     │  │
│                                └───────────────────────────────────────────────┘  │
│        │ structured SetResult / SessionResult                                     │
│        ▼                                                                           │
│  Local store (IndexedDB/localStorage): profile, settings, sessions, progress       │
│        │ (optional, when online + opted-in)                                        │
└────────┼───────────────────────────────────────────────────────────────────────┘
         ▼
   Backend (FastAPI or Next API) — THIN:
     POST /api/coach     LLM rephrasing of structured findings (no invention)
     POST /api/sessions  persist + sync   GET /api/progress  aggregates
     Cloud storage       only if user opts to store videos/photos
     Model registry      exercise-recognition model artifacts (TFLite/ONNX) for on-device use
```

Heavy compute stays on-device (privacy, cost, latency). The cloud is optional and thin. The
**analysis engine is framework-free TypeScript** so the same code runs in the web PWA today and
ports to React Native (vision-camera + MediaPipe/MoveNet TFLite, Skia overlay) unchanged.

---

## 6. Frontend Screens

1. **Onboarding / Profile** — age, gender, height, weight, units, goal, level, equipment,
   injuries, preferred feedback style.
2. **Home** — start Single-set (upload/live) or Session; recent sessions; quick progress glance.
3. **Camera-setup check** — live framing checklist + fix prompts before capture starts.
4. **Capture / Live** — video + skeleton overlay, live rep counter, silent form HUD, settings toggle.
5. **Set results / Session summary** — score, per-rep labels, issues+fixes, best/worst key frames,
   confidence breakdown, recommendation.
6. **Follow-up** — context questions → personalized recommendation.
7. **Progress** — history list, form-score trend, per-exercise & per-muscle progress, weight log,
   before/after photos.
8. **Settings** — feedback mode (silent/visual/haptic/voice), units, data & privacy.

---

## 7. Backend APIs (thin; MVP runs without them)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/coach` | Rephrase a structured SetResult into coaching text (LLM optional). |
| POST | `/api/sessions` | Persist a session (+ sets, reps, issues). |
| GET | `/api/sessions` | List sessions for a user. |
| GET | `/api/sessions/:id` | One session with frames + reps. |
| GET | `/api/progress` | Aggregated trends (score history, PRs, recurring faults, ROM). |
| POST | `/api/profile` | Upsert profile. |
| GET | `/api/models/:exercise` | Serve on-device recognition model artifacts. |

Auth via the host product's session/JWT. MVP persists locally; these are the sync target.

---

## 8. Database Schema

```sql
User(id, name, age, gender, height_cm, weight_kg, units,            -- kg|lbs
     goal, level, target_muscles JSONB, injuries JSONB,
     equipment JSONB, feedback_style, created_at)

Session(id, user_id, started_at, ended_at, mode,                    -- single|session
        overall_score, confidence, summary TEXT)

SetLog(id, session_id, exercise_name, variation, muscle_groups JSONB,
       order_index, rep_count, weight_kg, weight_source,            -- manual|history|estimated|recognized
       set_score, confidence, started_at, ended_at)

RepAnalysis(id, set_id, rep_number, start_time, end_time,
            joint_angles JSONB, metrics JSONB, detected_issues JSONB,
            rep_score INT, rep_label)                               -- good|minor|poor

FormIssue(id, set_id, issue_name, severity, affected_reps INT[],
          explanation, suggested_fix)

KeyFrame(id, set_id, rep_number, kind, t, image_url, annotations JSONB) -- best|worst|mistake

ExerciseRule(exercise_name PK, variation, required_camera_angle,
             tracked_joints JSONB, angle_thresholds JSONB, form_checks JSONB,
             muscle_groups JSONB)

ProgressSnapshot(id, user_id, taken_at, photo_url, weight_kg, note) -- before/after photos
```

In the MVP these are TypeScript types + on-device records with the **same field names**, so cloud
persistence is a 1:1 map.

---

## 9. Computer Vision Pipeline

```
frame ─► pose estimation ─► 33 landmarks (+visibility, world coords)
      ─► framing/quality gate (per frame + per set) ─► confidence inputs
      ─► exercise recognizer (per window) ─► exercise + variation + muscles
      ─► rep segmentation (per-exercise rep signal, hysteresis FSM)
      ─► joint-angle & metric extraction (angles, ROM, tempo, symmetry, stability)
      ─► form rule engine (per-exercise thresholds) ─► issues
      ─► rep & set scoring ─► confidence ─► key-frame selection
      ─► (user context) ─► LLM rephrasing ─► recommendation ─► logs/progress
```

Frame source: `requestVideoFrameCallback` (files) / `requestAnimationFrame` (live). We process at
the device's capable rate and timestamp every sample. We **never** trust a single frame — metrics
are taken over a rep window and gated by visibility.

---

## 10. Pose-Estimation Logic

- **Web/PWA (today):** MediaPipe Tasks Vision `PoseLandmarker` (lite, GPU delegate), 33 landmarks,
  normalized image coords + visibility + world landmarks.
- **iOS native (later):** Apple Vision body-pose (no model download, battery-efficient) or MoveNet
  Thunder via TFLite; **Android:** MediaPipe/MoveNet TFLite.
- Landmark indices fixed (nose 0, shoulders 11/12, elbows 13/14, wrists 15/16, hips 23/24,
  knees 25/26, ankles 27/28, heels 29/30, foot 31/32) so the engine is pose-backend-agnostic —
  we only adapt the thin adapter that maps a backend's output to `Landmark[]`.

---

## 11. Exercise-Recognition Logic (Phase 5)

Two-stage, cheap-first:
1. **Heuristic router (ships first):** from the landmark stream over a 2–3 s window, derive a small
   feature vector — orientation (standing/horizontal/inverted), which rep-signal is oscillating
   (knee vs elbow vs shoulder abduction), bar/hand path, vertical vs horizontal motion. Rules map
   these to a candidate exercise + variation. Cheap, explainable, no training data needed.
2. **Learned classifier (upgrade):** a small temporal model (1D-CNN/GRU or lightweight transformer)
   over normalized landmark sequences → exercise + variation, trained on labeled clips. Runs
   on-device (TFLite/ONNX). The heuristic router becomes the fallback / confidence cross-check.

**Variations** (e.g. barbell vs goblet squat, conventional vs Romanian deadlift, incline vs flat
push-up) are sub-labels distinguished by torso angle, hip-hinge ratio, implement position, and
support surface. **Muscle groups** are a static lookup keyed by exercise+variation (`muscleMap`).
Recognition always emits a **confidence**; below threshold we ask the user to confirm rather than
guess — trust over magic.

---

## 12. Rep-Counting Logic

Generic two-threshold hysteresis state machine over one scalar **rep signal** per exercise (knee
angle for squat, elbow angle for push-up/curl/press, shoulder abduction for lateral raise; deadlift
uses hip+knee extension; rows use elbow flexion + torso angle). Rules:
- Hysteresis (separate enter/exit thresholds) rejects jitter.
- A rep must clear a **minimum amplitude (ROM)** and **minimum duration** — so partial bounces are
  not miscounted, but imperfect reps still count (and get flagged on quality).
- Rep start is anchored at the **true top peak** so amplitude is measured correctly.
- Each rep stores its window of samples for downstream metric extraction and key-frame capture.
- Plank and other holds are scored as a single timed hold, not reps.

(✅ implemented and unit-tested headless in `web/test/engine.test.ts`.)

---

## 13. Form-Analysis Rules

Each exercise is a module: `repSignal`, bands, `analyzeRep` (per-rep angles + issues), `analyzeSet`
(cross-rep symmetry, consistency, tempo, **fatigue breakdown** = quality declining across reps).
Issue = `{name, severity (info/minor/major), affectedReps[], why, fix, penalty}`.

Examples (thresholds are tunable constants, documented inline):
- **Squat:** depth, knee valgus, torso lean, heel lift, L/R imbalance, tempo, consistency. ✅
- **Push-up:** elbow depth/ROM, hip sag/pike, head/neck, tempo, consistency. ✅
- **Bicep curl:** top/bottom ROM, elbow drift, torso swing/momentum, uneven arms, tempo. ✅
- **Shoulder press:** lockout, bottom depth, lean-back, L/R symmetry. ✅
- **Lateral raise:** raise height, over-raise/traps, swing, elbow bend. ✅
- **Plank:** hip sag/pike, neck, stability, drift-over-time. ✅
- **Deadlift / RDL (next):** hip hinge vs squat pattern, neutral-spine proxy (lumbar rounding),
  bar-path vertical, lockout, hip-shoulder rise sync; RDL = hinge-dominant with soft knees. ⬜
- **Lunge / Row (next):** front-knee tracking & depth; row = torso angle stability + elbow ROM +
  shrug check. ⬜

**Fatigue breakdown** is a first-class set-level check: compare early-rep vs late-rep depth/ROM/
symmetry; a downward trend produces "form breaking down due to fatigue (reps N–M)".

---

## 14. Scoring System

- Each rep starts at 100; each detected issue subtracts a severity-weighted penalty (info 0, minor
  6, major 15) **scaled by how far past threshold** the fault is (a near-miss costs less).
- `repScore = clamp(100 − Σpenalties)`; `rep_label` = Good ≥ 80, Minor 60–79, Poor < 60.
- `setScore = mean(repScores) − set-level penalties` (inconsistency, asymmetry, fatigue).
- Best/worst rep by score (ties broken by fewer major issues).
- Score is never silently fabricated under low confidence — we lower **confidence**, not the score,
  and label "uncertain".

---

## 15. Session-Mode Design (Phase 4)

A session is a state machine over the continuous stream:
```
IDLE ─(motion + recognizable pattern)─► ACTIVE_SET ─(N reps, then stillness > rest_gap)─► REST
REST ─(new movement)─► ACTIVE_SET(next)   REST(long) or user "end" ─► SUMMARY
```
- **Set boundary** = a rest gap (low movement energy for > ~5 s) or a recognized exercise change.
- Each ACTIVE_SET runs the single-set pipeline; results are appended to the session.
- **Exercise change** detected by the recognizer; if confidence is low, the set is tagged
  "unconfirmed" and the user can correct it in the summary (one tap), which also improves future
  recognition.
- End-of-session **summary**: exercises detected, sets, reps, weights (entered/estimated), per-set
  form scores, best/worst reps, mistakes, improvements across the session, next-workout rec.
- Runs fully on-device; the phone can be across the room — feedback is silent/visual + optional
  haptic/voice so it never competes with the user's music.

---

## 16. Weight-Logging Design

Weight per set comes from, in priority order:
1. **Manual entry** (fast chip UI, remembers last value per exercise).
2. **History default** (pre-fill from the user's last session for that exercise).
3. **Estimated** from user RPE + rep count + history (a simple model, clearly labeled "estimated").
4. **Recognized** (later, best-effort): read plate/dumbbell markings via OCR/detector when clearly
   visible; always shown as a suggestion to confirm, never silently trusted.

Weight feeds recommendations: e.g. "form stable at 20 kg, broke down at 25 kg → try 22.5 kg, slower
reps." Stored on each `SetLog` with its `weight_source` so progress graphs can be honest.

---

## 17. Progress-Tracking Design

On-device store of every session/set/rep. The Progress screen shows:
- **Form-score trend** (per exercise and overall) over time.
- **Strength/volume**: top weight, total reps & sets, est. 1RM trend.
- **Quality**: recurring mistakes (most-frequent issues), ROM improvement, consistency (score
  variance shrinking), best lifts/PRs.
- **Weekly / monthly summaries**; **per-muscle-group** rollups via the muscle map.
- **Before/after photos** the user optionally uploads (stored locally; never auto-shared).

MVP renders the trend with lightweight inline SVG/canvas charts (no heavy dependency).

---

## 18. User-Profile Design

Fields: age, gender, height, weight, units (kg/lbs), goal (strength/muscle/fat-loss/general),
level (beginner/intermediate/advanced), target muscles, injuries/limitations, equipment access,
preferred workout style, preferred feedback style (silent/visual/haptic/voice).

Personalization rules: **beginners** get simpler, safer, fewer-issue feedback (top 1–2 fixes, plain
language, conservative load advice); **advanced** users get full biomechanical detail and finer
thresholds. Injuries bias recommendations toward safer variations and trigger earlier caution.
Units propagate everywhere. Feedback style controls the alert channel (and defaults to silent).

---

## 19. LLM Feedback Prompt Design

The LLM is a **rephraser**, never a judge.
```
SYSTEM: You are a supportive, expert strength coach. You receive STRUCTURED analysis JSON from a
deterministic form-analysis engine. Explain it in clear, encouraging, plain language, tuned to the
user's level. HARD RULES: discuss ONLY issues present in the JSON — never invent faults, numbers, or
reps. Never give medical/injury diagnoses; if redFlags is non-empty or pain is reported, advise
consulting a qualified professional and don't speculate on cause. Be concise: one-line summary, main
issue, 1–2 secondary issues, next-set action. Second person; explain any jargon in ≤3 words.
USER (JSON): { exercise, variation, repCount, overallScore, confidence, bestRep, worstRep,
  reps:[{n,label,angles}], issues:[{name,severity,affectedReps,why,fix}], context:{profile,answers},
  redFlags:[...] }
```
MVP ships a deterministic renderer producing this text with **no network call**; `/api/coach` swaps
in Claude (`claude-opus-4-8`) with the same prompt and the same hard rules. (✅ both implemented.)

---

## 20. Safety Guardrails

- Never diagnose; fixed disclaimer on every result and follow-up. ✅
- **Red-flag interception**: sharp pain, chest pain, dizziness, numbness, sudden weakness, severe or
  worsening pain → suppress training advice, show "stop and consult a professional." ✅
- Pain-without-red-flag → ease off + safer variation, never push through pain. ✅
- **Uncertainty honesty**: partial body / poor lighting / bad angle / low tracking → confidence
  breakdown + "analysis uncertain" + re-record guidance; never claim 100% accuracy. ✅
- Conservative-by-default load advice when unsure. ✅

---

## 21. Confidence-Scoring System

Per-frame quality + per-set aggregate produce a **breakdown the user can see**:
```
Analysis confidence: 86%
  Full body visible: Yes      Camera angle: Good
  Feet visible: Yes           Lighting: Good
  Centered in frame: Yes      Pose tracking: Good
  Exercise detected: Squat (manual)
```
Inputs: average joint visibility for the exercise's tracked joints, fraction of usable frames,
in-frame fraction (landmarks within [0,1]), brightness proxy, centering, and (later) recognition
confidence. Low confidence (< ~55%) flips the result to **uncertain** with a specific reason and a
re-record prompt. (✅ implemented as a structured breakdown.)

---

## 22. Development Roadmap

- **Phase 1 ✅** Squat single-set: upload, landmarks, skeleton, reps, knee/hip/torso angles, basic
  issues, best/worst rep.
- **Phase 2 ✅** Push-ups + bicep curls (+ shoulder press, lateral raise, plank).
- **Phase 3 ✅** Live-camera analysis.
- **Phase 3.5 ✅ (this iteration)** Confidence breakdown, camera-setup check, per-rep labels,
  best/worst key-frame screenshots, audio-safe feedback settings, local progress tracker + profile.
- **Phase 4 ⬜** Session mode (continuous, auto set/rest segmentation, end-of-session summary).
- **Phase 5 ⬜** Automatic exercise recognition (heuristic router → learned classifier) + variations.
- **Phase 6 ⬜** Cloud sync, accounts, richer progress analytics, before/after photos sync.
- **Phase 7 ⬜** Advanced personalization, deadlift/RDL/lunge/row/bench/machine coverage, weight
  recognition.

---

## 23. Folder Structure

```
gyminai/
  IMPLEMENTATION_PLAN.md        # v1
  PLAN_V2.md                    # this file
  web/
    app/                page · analyze · dashboard · progress · profile · settings · api/coach
    components/         charts, HUD, key-frame viewer (as needed)
    lib/
      pose/             landmarker, landmarks, skeleton, frameCapture
      analysis/         types, math, quality(+confidence), framing, repCounter, scoring,
                        engine, recognize (router), exercises/*  (squat…plank, deadlift…)
      feedback/         channels (silent/visual/haptic/voice) — audio-safe
      llm/              coach (renderer + prompt)
      db.ts             on-device store: profile, settings, sessions, progress
      questions.ts      follow-up + recommendation
      muscleMap.ts      exercise → muscle groups
    test/               headless engine tests
```

---

## 24. Starter Code for the MVP

`web/` is a runnable Next.js app. The analysis engine (`lib/analysis`) is fully implemented and
headless-unit-tested; pose (`lib/pose`) wraps MediaPipe; UI is App Router + React. This iteration
adds `framing.ts`, confidence breakdown, rep labels, key-frame capture, `feedback/`, `db.ts`,
`muscleMap.ts`, and the Progress/Profile/Settings screens. Run:

```bash
cd web && npm install && npm run dev      # http://localhost:3000
npm test                                  # headless engine tests
```

---

## 25. Best Tech Stack

- **Pose:** MediaPipe Tasks Vision (web) → MoveNet/MediaPipe TFLite (Android) + Apple Vision (iOS).
- **Engine:** framework-free **TypeScript** (shared web ↔ native).
- **App:** Next.js + React (PWA) now; **React Native + Vision Camera + Skia** for the production
  mobile app, reusing the engine verbatim.
- **On-device storage:** IndexedDB (via a thin wrapper); MVP uses localStorage.
- **Backend (thin):** Next.js API routes or FastAPI; **Postgres** (Supabase) for sync; object
  storage (S3/Supabase) only if users opt to store media.
- **LLM:** Claude (`claude-opus-4-8`) for coaching rephrasing — structured-in, prose-out, no invention.
- **Recognition model (Phase 5):** train in PyTorch → export TFLite/ONNX for on-device inference.
- **Charts:** inline SVG/canvas (no heavy dep) for the MVP; swap to a chart lib if needed.

Principle throughout: **on-device, rules-first, confidence-always, music-never-interrupted.**
