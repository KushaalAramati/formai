// Phase 4: follow-up questionnaire + rule-based personalized recommendation.
import type { SetResult, UserContext } from './analysis/types';

export interface Question {
  id: keyof UserContext;
  label: string;
  type: 'bool' | 'choice' | 'scale' | 'text' | 'multi';
  options?: { value: string; label: string }[];
}

export const QUESTIONS: Question[] = [
  { id: 'pain', label: 'Did you feel any pain during the set?', type: 'bool' },
  { id: 'painLocation', label: 'If yes, where? (e.g. knee, lower back)', type: 'text' },
  { id: 'weight', label: 'What weight were you using? (optional)', type: 'text' },
  { id: 'rpe', label: 'How hard was the set, 1–10?', type: 'scale' },
  {
    id: 'goal',
    label: 'What is your main goal?',
    type: 'choice',
    options: [
      { value: 'strength', label: 'Strength' },
      { value: 'muscle', label: 'Build muscle' },
      { value: 'endurance', label: 'Endurance' },
      { value: 'general', label: 'General fitness' },
    ],
  },
  {
    id: 'level',
    label: 'How would you describe yourself?',
    type: 'choice',
    options: [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'advanced', label: 'Advanced' },
    ],
  },
  { id: 'injury', label: 'Are you recovering from an injury?', type: 'bool' },
  {
    id: 'equipment',
    label: 'What equipment do you have access to?',
    type: 'multi',
    options: [
      { value: 'bodyweight', label: 'Bodyweight only' },
      { value: 'dumbbells', label: 'Dumbbells' },
      { value: 'barbell', label: 'Barbell' },
      { value: 'machines', label: 'Machines' },
    ],
  },
];

export type Action =
  | 'continue'
  | 'lower_weight'
  | 'technique_first'
  | 'easier_variation'
  | 'safer_variation'
  | 'machine_alternative'
  | 'stop_consult';

export interface Recommendation {
  action: Action;
  headline: string;
  detail: string;
  /** true => safety override; suppress training advice. */
  redFlag: boolean;
}

const REDFLAG_WORDS = /sharp|numb|dizzy|dizziness|chest|tingl|faint|shooting/i;

export function recommend(result: SetResult, ctx: UserContext): Recommendation {
  // 1) Safety first — red flags override everything.
  const painRedFlag =
    ctx.pain && (REDFLAG_WORDS.test(ctx.painLocation ?? '') || (ctx.rpe ?? 0) >= 9);
  if (ctx.pain && (painRedFlag || REDFLAG_WORDS.test(ctx.painLocation ?? ''))) {
    return {
      action: 'stop_consult',
      redFlag: true,
      headline: 'Stop and check in with a professional',
      detail:
        'You reported pain with possible warning signs. Sharp pain, numbness, dizziness, or chest ' +
        'symptoms are not something this app can assess. Please stop and consult a qualified ' +
        'healthcare or fitness professional before continuing.',
    };
  }
  if (ctx.pain) {
    return {
      action: 'safer_variation',
      redFlag: false,
      headline: 'Ease off and switch to a safer variation',
      detail:
        'Since you felt pain, reduce the load and move to a more controlled variation. If pain ' +
        'persists or sharpens, stop and consult a professional. Never push through pain.',
    };
  }

  const major = result.issues.filter((i) => i.severity === 'major').length;
  const hard = (ctx.rpe ?? 0) >= 9;

  // 2) Form-driven decisions.
  if (major >= 1 && result.overallScore < 60) {
    if (hard) {
      return {
        action: 'lower_weight',
        redFlag: false,
        headline: 'Lower the weight and clean up form',
        detail:
          'Form broke down on a hard set. Drop the weight ~10–20% so you can fix the main issue ' +
          'before loading it again.' + equip(ctx),
      };
    }
    return {
      action: 'technique_first',
      redFlag: false,
      headline: 'Prioritize technique before adding load',
      detail:
        'There is a clear form issue to fix first. Keep the weight light and groove the movement ' +
        'pattern until it is consistent.' + equip(ctx),
    };
  }

  if (result.overallScore < 75) {
    return {
      action: 'easier_variation',
      redFlag: false,
      headline: 'Use an easier variation to build the pattern',
      detail:
        'Form is okay but inconsistent. A slightly easier variation will let you own the technique, ' +
        'then progress back up.' + equip(ctx),
    };
  }

  if (hard) {
    return {
      action: 'continue',
      redFlag: false,
      headline: 'Solid set — repeat before progressing',
      detail:
        'Good form on a tough set. Stay at this weight until it feels easier (RPE ~7–8), then add a ' +
        'small increment.',
    };
  }

  return {
    action: 'continue',
    redFlag: false,
    headline: 'Great set — progress next time',
    detail:
      'Form looks good and the set was manageable. Add a little weight or one or two reps next session.' +
      equip(ctx),
  };
}

function equip(ctx: UserContext): string {
  if (ctx.equipment?.includes('machines')) {
    return ' If you want extra stability while you fix it, a machine version is a good option.';
  }
  return '';
}
