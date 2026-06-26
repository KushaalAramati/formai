// Optional LLM phrasing endpoint. Accepts a SetResult (+ optional UserContext), returns coaching
// text. If ANTHROPIC_API_KEY is set it asks Claude to REPHRASE the structured findings (never
// invent). Otherwise it returns the deterministic renderer output unchanged.
import { NextResponse } from 'next/server';
import { buildLlmPrompt, renderCoaching } from '@/lib/llm/coach';
import { getExercise } from '@/lib/analysis/exercises';
import type { SetResult, UserContext } from '@/lib/analysis/types';

export async function POST(req: Request) {
  const body = (await req.json()) as { result: SetResult; context?: UserContext };
  const ex = getExercise(body.result.exercise);
  if (!ex) return NextResponse.json({ error: 'unknown exercise' }, { status: 400 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // No LLM configured — return the deterministic coaching the client already has.
    return NextResponse.json({ text: renderCoaching(ex, body.result), source: 'deterministic' });
  }

  const { system, user } = buildLlmPrompt(body.result, body.context);
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 600,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const data = await resp.json();
    const text = data?.content?.[0]?.text ?? renderCoaching(ex, body.result);
    return NextResponse.json({ text, source: 'llm' });
  } catch {
    return NextResponse.json({ text: renderCoaching(ex, body.result), source: 'deterministic' });
  }
}
