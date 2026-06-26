// On-device persistence (localStorage). Privacy-first: nothing leaves the device.
// Field names mirror the Phase-6 Postgres schema so cloud sync is a 1:1 map later.
import type { TrainingLevel } from './analysis/types';
import { DEFAULT_FEEDBACK, type FeedbackSettings } from './feedback/channels';

export interface Profile {
  name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | '';
  heightCm?: number;
  weightKg?: number;
  goal?: 'strength' | 'muscle' | 'fatloss' | 'general';
  level?: TrainingLevel;
  equipment?: ('bodyweight' | 'dumbbells' | 'barbell' | 'machines')[];
  injuries?: string;
}

export interface SessionRecord {
  id: string;
  date: number; // epoch ms
  exercise: string;
  muscleGroups: string[];
  repCount: number;
  holdSeconds?: number;
  overallScore: number;
  confidence: number;
  weightKg?: number;
  topIssue?: string;
}

const K = {
  profile: 'gymai.profile',
  settings: 'gymai.settings',
  sessions: 'gymai.sessions',
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

export const getProfile = () => read<Profile>(K.profile, {});
export const saveProfile = (p: Profile) => write(K.profile, p);

export const getSettings = () => read<FeedbackSettings>(K.settings, DEFAULT_FEEDBACK);
export const saveSettings = (s: FeedbackSettings) => write(K.settings, s);

export const getSessions = (): SessionRecord[] =>
  read<SessionRecord[]>(K.sessions, []).sort((a, b) => b.date - a.date);

export function addSession(rec: SessionRecord) {
  const all = read<SessionRecord[]>(K.sessions, []);
  // de-dupe by id (avoid double-save on dashboard re-render)
  if (all.some((s) => s.id === rec.id)) return;
  all.push(rec);
  write(K.sessions, all);
}

export function lastWeightFor(exercise: string): number | undefined {
  return getSessions().find((s) => s.exercise === exercise && s.weightKg != null)?.weightKg;
}
