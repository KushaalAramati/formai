# GymAI — AI Gym Form Coach

> "An AI gym form coach that watches your lifts, explains your mistakes, and tells you what to fix next."

This document is the full implementation plan. Working MVP code lives in `web/`.

---

## 1. Product Overview

GymAI watches a set (uploaded video or live camera), detects body pose frame-by-frame, counts
reps, measures joint angles / depth / tempo / symmetry, runs **exercise-specific rule engines**
to find form faults, scores the set, and explains — in plain coaching language — *what* went
wrong, *which reps*, *why it matters*, *how to fix it*, and *what to do next set*.

Core principles:
- **Rules first, LLM second.** All judgments come from a deterministic rule engine. The LLM only
  rephrases structured findings into friendly coaching. It can never invent a fault.
- **Honest about uncertainty.** If the body isn't fully visible, the angle is bad, or detection
  confidence is low, we say "analysis uncertain" instead of guessing.
- **Not medical.** We never diagnose. Pain / numbness / dizziness / chest pain → "see a professional."

Target users: beginners who need guidance, and serious lifters who want objective metrics.

---

## 2. MVP Feature List

- Upload a video **or** use live camera.
- Manual exercise selection (auto-detect is a later phase; MVP ships a heuristic detector stub).
- Client-side pose estimation (MediaPipe Pose Landmarker, 33 landmarks).
- Live skeleton overlay drawn on a canvas above the video.
- Per-frame metrics: joint angles, depth proxy, tempo, left/right symmetry, range of motion (ROM).
- Rep segmentation via a state machine; per-rep start/end timestamps.
- Exercise rule engines: **squat, push-up, bicep curl, shoulder press, lateral raise, plank**.
- Set scoring (0–100) with per-rep scores, best/worst rep.
- Results dashboard: score, rep count, issues, fixes, next-set recommendation.
- Follow-up questionnaire → personalized recommendation.
- Quality guardrails: poor video / partial body / bad angle warnings.

Out of scope for MVP: accounts, cloud storage, multi-user history (Phase 5), barbell tracking,
3D pose, multi-person.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (MVP)                           │
│                                                              │
│  Camera / <video>  ──frames──►  MediaPipe PoseLandmarker     │
│        │                              │ landmarks[33]/frame  │
│        ▼                              ▼                       │
│  Canvas skeleton overlay        Analysis Engine (pure TS)    │
│                                   • angles.ts                │
│                                   • repCounter (FSM)         │
│                                   • exercises/<name>.ts      │
│                                   • scoring.ts               │
│                                          │ structured result │
│                                          ▼                   │
│                                   Dashboard + FollowUp        │
│                                          │                   │
│                                          ▼ (optional)        │
│                                   /api/coach ──► LLM          │
└─────────────────────────────────────────────────────────────┘

Phase 4+ backend (FastAPI or Next API routes):
  POST /api/coach        → LLM phrasing of structured findings
  POST /api/sessions     → persist WorkoutSession + RepAnalysis (Postgres)
  GET  /api/progress     → history, trends
  Cloud storage (S3/Supabase) only needed if we keep videos server-side.
```

The heavy compute (pose) runs on-device. The server is thin: only LLM phrasing + persistence.
This keeps cost near zero and privacy high (video never leaves the device in the MVP).

**Mobile port path:** the `web/lib/analysis/*` folder is framework-free TypeScript. In React
Native we swap the pose source (MediaPipe Tasks Vision → `react-native-vision-camera` +
MediaPipe / MoveNet TFLite) and the canvas overlay (Skia), but reuse the entire engine verbatim.

---

## 4. Frontend Screens

1. **Home / Capture** — pick exercise, choose Upload or Live Camera, camera-angle guidance.
2. **Analyze** — video/camera with live skeleton overlay + live rep counter & form hints.
3. **Results Dashboard** — score gauge, rep timeline, issues list, fixes, next-set rec.
4. **Follow-up** — context questions (pain, weight, RPE, goal, level, injury, equipment).
5. **Recommendation** — personalized next-step card.
6. (Phase 5) **Progress** — score history, recurring mistakes, ROM/consistency trends.

---

## 5. Backend APIs (Phase 4+)

| Method | Path             | Purpose                                                        |
|--------|------------------|----------------------------------------------------------------|
| POST   | `/api/coach`     | Body = structured analysis result → returns LLM coaching text. |
| POST   | `/api/sessions`  | Persist a WorkoutSession + its RepAnalysis rows.               |
| GET    | `/api/sessions`  | List a user's sessions.                                        |
| GET    | `/api/sessions/:id` | One session with reps + issues.                             |
| GET    | `/api/progress`  | Aggregated trends (score history, common faults, ROM).         |
| POST   | `/api/recommend` | Follow-up answers + analysis → recommendation.                 |

Auth: reuse whatever the rest of the product uses (JWT/session). MVP runs without auth.

---

## 6. Database Schema (Phase 4+, Postgres)

```sql
User(
  id PK, name, age_range, training_level,        -- beginner|intermediate|advanced
  fitness_goal, injury_flags JSONB, equipment_access JSONB, created_at
)
WorkoutSession(
  id PK, user_id FK, exercise_name, video_url NULL,
  created_at, rep_count INT, overall_score INT, summary_feedback TEXT
)
RepAnalysis(
  id PK, session_id FK, rep_number INT,
  start_time FLOAT, end_time FLOAT,
  joint_angles JSONB, detected_issues JSONB, rep_score INT
)
FormIssue(
  id PK, session_id FK, issue_name, severity,    -- info|minor|major
  affected_reps INT[], explanation TEXT, suggested_fix TEXT
)
ExerciseRule(
  exercise_name PK, required_camera_angle,        -- side|front|45
  tracked_joints JSONB, angle_thresholds JSONB, form_checks JSONB
)
```

In the MVP these are TypeScript types in `web/lib/analysis/types.ts`; the SQL above is the
Phase-4 persistence target with identical field names.

---

## 7. Pose-Estimation Pipeline

1. Load MediaPipe `PoseLandmarker` (Tasks Vision, WASM + GPU delegate), model `pose_landmarker_lite`.
2. For each frame (`requestVideoFrameCallback` for files, `requestAnimationFrame` for live):
   - run `detectForVideo(video, timestampMs)` → `landmarks[33]` (normalized 0–1) + `worldLandmarks`
     + per-landmark `visibility`.
3. Push a **frame sample** `{ t, landmarks, visibility, quality }` into a ring buffer.
4. Compute a **quality gate** per frame: are the joints this exercise needs visible enough?
   Low average visibility or missing key joints → frame flagged uncertain.
5. Draw skeleton (connections + joints) on the overlay canvas, color-coded by live form state.
6. Feed each sample to the analysis engine incrementally (live) or in batch (after upload).

Landmark index reference (MediaPipe Pose): 0 nose, 11/12 shoulders, 13/14 elbows, 15/16 wrists,
23/24 hips, 25/26 knees, 27/28 ankles, 29/30 heels, 31/32 foot-index.

---

## 8. Rep-Counting Logic

A generic **two-phase state machine** driven by one scalar "rep signal" per exercise (e.g. knee
angle for squat, elbow angle for curl/push-up, shoulder abduction for lateral raise):

```
states: TOP ──(signal crosses into bottom band & moving down)──► BOTTOM
        BOTTOM ──(signal crosses back into top band)──► TOP  ⇒ count 1 rep
```

- Bands use hysteresis (separate enter/exit thresholds) to reject jitter.
- A rep must exceed a **minimum amplitude** (ROM) and **minimum duration** to count — this rejects
  bounces and partials being miscounted as reps (partials are still recorded, flagged "incomplete ROM").
- Each completed rep stores `{ repNumber, startT, endT, peakSignal, bottomSignal, samples[] }`.
- Plank has no reps — it's scored as a single timed hold.

---

## 9. Form-Analysis Logic

Each exercise exports a module implementing:

```ts
interface ExerciseModule {
  name: string;
  requiredCameraAngle: 'side' | 'front' | '45';
  trackedJoints: number[];
  repSignal(s: FrameSample): number | null;     // scalar that drives rep counting
  topBand: [number, number]; bottomBand: [number, number];
  analyzeRep(rep: Rep): RepFinding;              // per-rep angles + issues
  analyzeSet(reps: Rep[]): SetFinding;           // cross-rep: symmetry, consistency, tempo
}
```

Example checks (thresholds are tunable constants, documented inline):

- **Squat** — depth (hip-below-knee proxy via knee angle ≤ target), knee valgus (knee-X inside
  ankle-X on front view), torso lean (trunk vs vertical), heel lift (heel Y rising), L/R imbalance
  (knee-angle delta), tempo (concentric/eccentric seconds), rep consistency (variance of depth).
- **Push-up** — bottom elbow angle (depth), hip sag/pike (shoulder-hip-knee colinearity), partial
  ROM, head/neck (ear-shoulder line), shoulder elevation, tempo.
- **Bicep curl** — elbow drift (elbow X/Y travel away from torso), shoulder swing (shoulder &
  hip sway), momentum (peak concentric speed), incomplete ROM (top & bottom elbow angle), uneven
  arms (L vs R angle), tempo.
- **Shoulder press** — lockout, elbow flare, lumbar/torso lean, L/R press symmetry, tempo.
- **Lateral raise** — raise height (abduction angle), trap shrug, momentum/swing, elbow bend
  consistency, L/R symmetry, tempo.
- **Plank** — hip sag/pike, neck position, hold duration, drift over time.

Every issue carries `{ name, severity, affectedReps[], why, fix }`.

---

## 10. Scoring System

- Start each rep at 100. Each detected issue subtracts a weighted penalty by severity
  (`info` 0, `minor` 6, `major` 15) scaled by how far past threshold it is.
- `repScore = clamp(100 - Σ penalties, 0, 100)`.
- `setScore = mean(repScores)` minus set-level penalties (e.g. high inconsistency, asymmetry).
- Best rep = max repScore; worst = min. Ties broken by fewer major issues.
- If a large fraction of frames were "uncertain", we lower **confidence** (not the score) and label
  the result "analysis uncertain".

---

## 11. LLM Feedback Prompt Design

The LLM is a **rephraser**, not a judge. We send it only structured findings and forbid invention.

```
SYSTEM:
You are a supportive, expert strength coach. You will receive STRUCTURED analysis JSON from a
deterministic form-analysis engine. Your job: explain it in clear, encouraging, plain language.
HARD RULES:
- Only discuss issues present in the JSON. Never invent faults, numbers, or reps.
- Never give medical or injury diagnoses. If `redFlags` is non-empty or pain is reported, advise
  consulting a qualified professional and do not speculate on causes.
- Keep it concise: a 1-line summary, the main issue, 1–2 secondary issues, and a next-set action.
- Use second person ("your knees"), no jargon without a 3-word explanation.

USER (JSON):
{ exercise, repCount, overallScore, confidence, bestRep, worstRep,
  issues:[{name, severity, affectedReps, why, fix}], context:{...answers}, redFlags:[...] }
```

MVP ships a **deterministic template renderer** (`lib/llm/coach.ts`) that produces this text with
no network call, plus an optional `/api/coach` route that swaps in a real LLM with the same prompt.

---

## 12. Safety Guardrails

- No diagnosis, ever. Fixed disclaimer on results + follow-up.
- Red-flag interception: if the user reports sharp pain, numbness, dizziness, chest pain, or other
  unusual symptoms → suppress training advice, show "stop and consult a professional."
- Uncertainty honesty: partial body / low visibility / bad angle → "analysis uncertain," reduced
  confidence, and a prompt to re-record from the recommended angle.
- Never claim 100% accuracy; confidence is always shown.
- Conservative load advice: when in doubt, recommend lowering weight / regressing the movement.

---

## 13. Development Roadmap

- **Phase 1 (this MVP):** upload/live, pose + skeleton, rep count, angles, squat feedback.
- **Phase 2:** push-ups + bicep curls (engines added — already included here).
- **Phase 3:** results dashboard (included here).
- **Phase 4:** follow-up questions + personalized recs (included here) → wire real LLM + persistence.
- **Phase 5:** progress tracking (score history, common mistakes, ROM/consistency, strength trend).

The MVP in `web/` already reaches into Phase 4 functionally (rules-based), with the LLM and DB as
drop-in upgrades.

---

## 14. Folder Structure

```
gyminai/
  IMPLEMENTATION_PLAN.md
  web/
    package.json, next.config.mjs, tsconfig.json, next-env.d.ts
    app/
      layout.tsx, globals.css
      page.tsx                 # Home / capture
      analyze/page.tsx         # Stage with overlay + live coaching
      api/coach/route.ts       # optional LLM phrasing endpoint
    components/
      ExercisePicker.tsx, VideoStage.tsx, LiveHud.tsx,
      Dashboard.tsx, FollowUp.tsx, ScoreGauge.tsx
    lib/
      pose/
        landmarker.ts          # MediaPipe init + detect loop
        landmarks.ts           # index constants + helpers
        skeleton.ts            # canvas drawing
      analysis/
        types.ts
        math.ts                # angle, vectors, smoothing
        quality.ts             # visibility / angle gate
        repCounter.ts          # generic FSM
        scoring.ts
        engine.ts              # orchestrates an exercise over samples
        exercises/
          index.ts, squat.ts, pushup.ts, curl.ts,
          shoulderPress.ts, lateralRaise.ts, plank.ts
      llm/coach.ts             # deterministic coaching renderer + prompt
      questions.ts             # follow-up questionnaire + recommendation logic
      store.ts                 # in-memory result hand-off between pages
```

---

## 15. Starter Code

See `web/`. The analysis engine (`lib/analysis`) is fully implemented and unit-testable without a
browser. The pose layer (`lib/pose`) wraps MediaPipe Tasks Vision. UI is Next.js App Router + React.

### Run

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

Allow camera access for live mode, or drag in a video for upload mode. Record from the
**side** for squat / push-up / curl / shoulder press, and from the **front** for lateral raise;
plank from the side.
