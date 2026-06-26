// Deterministic coaching renderer. Produces the human-readable summary WITHOUT a network call,
// using only the structured SetResult. The same JSON + prompt (below) can be sent to a real LLM
// via /api/coach to get a warmer phrasing — but the LLM may NEVER add issues not present here.
import type { ExerciseModule, SetResult, UserContext } from '../analysis/types';

const DISCLAIMER =
  'This is automated form feedback, not medical advice. Sharp pain, numbness, dizziness, ' +
  'chest pain, or other unusual symptoms should be discussed with a qualified professional.';

export function renderCoaching(ex: ExerciseModule, r: SetResult): string {
  const lines: string[] = [];
  lines.push(`Exercise: ${ex.label}`);

  if (ex.isHold) {
    lines.push(`Hold time: ${r.holdSeconds ?? 0}s`);
  } else {
    lines.push(`Reps detected: ${r.repCount}`);
  }
  lines.push(`Overall form score: ${r.overallScore}/100`);

  if (r.uncertain) {
    lines.push('');
    lines.push(
      '⚠️ Analysis uncertain — capture quality or visibility was low, so treat the numbers as a rough guide.'
    );
  }

  const major = r.issues.filter((i) => i.severity === 'major');
  const minor = r.issues.filter((i) => i.severity === 'minor');

  lines.push('');
  if (!r.issues.length && r.repCount > 0) {
    lines.push('Main issue: none detected — solid set. Keep the same control and depth.');
  } else if (r.issues.length) {
    const main = r.issues[0];
    lines.push(`Main issue: ${describe(main)}`);
    const second = r.issues[1];
    if (second) lines.push(`Secondary issue: ${describe(second)}`);
  }

  if (r.bestRep) lines.push(`Best rep: Rep ${r.bestRep}.`);
  if (r.worstRep && r.worstRep !== r.bestRep) lines.push(`Worst rep: Rep ${r.worstRep}.`);

  // Fix-for-next-set: take the top issue's fix, or reinforce on a clean set.
  lines.push('');
  if (major.length) {
    lines.push(`Fix for next set: ${major[0].fix}`);
  } else if (minor.length) {
    lines.push(`Fix for next set: ${minor[0].fix}`);
  } else if (r.repCount > 0) {
    lines.push('Fix for next set: Nothing to change — consider adding a little weight or one more rep.');
  }

  if (r.warnings.length) {
    lines.push('');
    lines.push(`Notes: ${r.warnings.join(' ')}`);
  }

  lines.push('');
  lines.push(DISCLAIMER);
  return lines.join('\n');
}

function describe(i: { name: string; affectedReps: number[]; why: string }): string {
  const reps = i.affectedReps.length ? ` (reps ${formatReps(i.affectedReps)})` : '';
  return `${i.name}${reps}. ${i.why}`;
}

function formatReps(reps: number[]): string {
  if (reps.length === 1) return `${reps[0]}`;
  // collapse contiguous runs: 4,5,6 -> 4–6
  const sorted = [...reps].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      parts.push(start === prev ? `${start}` : `${start}–${prev}`);
      start = sorted[i];
      prev = sorted[i];
    }
  }
  return parts.join(', ');
}

/** The exact prompt used if/when a real LLM is wired in (see app/api/coach/route.ts). */
export function buildLlmPrompt(r: SetResult, ctx?: UserContext) {
  const system =
    'You are a supportive, expert strength coach. You will receive STRUCTURED analysis JSON from ' +
    'a deterministic form-analysis engine. Explain it in clear, encouraging, plain language. ' +
    'HARD RULES: Only discuss issues present in the JSON — never invent faults, numbers, or reps. ' +
    'Never give medical or injury diagnoses; if redFlags is non-empty or pain is reported, advise ' +
    'consulting a qualified professional and do not speculate on causes. Keep it concise: a one-line ' +
    'summary, the main issue, one or two secondary issues, and a next-set action. Use second person.';
  const user = JSON.stringify(
    {
      exercise: r.exercise,
      repCount: r.repCount,
      holdSeconds: r.holdSeconds,
      overallScore: r.overallScore,
      confidence: Number(r.confidence.toFixed(2)),
      uncertain: r.uncertain,
      bestRep: r.bestRep,
      worstRep: r.worstRep,
      issues: r.issues.map((i) => ({
        name: i.name,
        severity: i.severity,
        affectedReps: i.affectedReps,
        why: i.why,
        fix: i.fix,
      })),
      context: ctx ?? null,
      redFlags: ctx?.pain ? ['user reported pain'] : [],
    },
    null,
    2
  );
  return { system, user };
}
