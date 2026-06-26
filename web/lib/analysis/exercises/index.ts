import type { ExerciseModule } from '../types';
import { squat } from './squat';
import { pushup } from './pushup';
import { curl } from './curl';
import { shoulderPress } from './shoulderPress';
import { lateralRaise } from './lateralRaise';
import { plank } from './plank';

export const EXERCISES: Record<string, ExerciseModule> = {
  squat,
  pushup,
  curl,
  shoulderPress,
  lateralRaise,
  plank,
};

export const EXERCISE_LIST = Object.values(EXERCISES);

export function getExercise(name: string): ExerciseModule | undefined {
  return EXERCISES[name];
}
