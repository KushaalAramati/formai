# GymAI — AI Form Coach (MVP)

Browser-based AI gym form coach. Records or uploads a set, runs MediaPipe Pose in-browser,
counts reps, analyzes form with exercise-specific rule engines, scores the set, and gives
rep-by-rep coaching + a personalized next-step recommendation.

See [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) for the full design.

## Run

```bash
npm install
npm run dev        # http://localhost:3000  (preview uses :3010)
npm test           # headless engine tests (rep counting, scoring, form rules)
```

Pick an exercise, choose **Upload** or **Live camera**, perform/record the set. Record from the
**side** for squat / push-up / curl / shoulder press, the **front** for lateral raise, side for plank.

## What works today

- 6 exercises: squat, push-up, bicep curl, shoulder press, lateral raise, plank.
- In-browser pose estimation + live skeleton overlay (your video never leaves the device).
- Rep counting (hysteresis FSM) + per-rep angles, depth, tempo, symmetry.
- Form rule engines → issues with severity, affected reps, why-it-matters, and a fix.
- 0–100 scoring with best/worst rep, results dashboard.
- Follow-up questionnaire → rule-based recommendation with safety guardrails.
- Optional `/api/coach` route: set `ANTHROPIC_API_KEY` to have an LLM rephrase the
  structured findings (it can never invent new faults).

## Architecture

- `lib/analysis/*` — framework-free TypeScript engine (port target for React Native).
- `lib/pose/*` — MediaPipe Tasks Vision wrapper + canvas skeleton.
- `app/*` — Next.js App Router UI.

## Not medical advice

Automated form feedback only. Pain, numbness, dizziness, or chest symptoms → see a professional.
