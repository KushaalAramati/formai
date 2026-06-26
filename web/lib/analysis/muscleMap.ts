// Static lookup: exercise -> primary muscle groups worked. Shown in results + used for
// per-muscle progress rollups.
export const MUSCLE_MAP: Record<string, string[]> = {
  squat: ['Quads', 'Glutes', 'Hamstrings'],
  pushup: ['Chest', 'Shoulders', 'Triceps'],
  curl: ['Biceps'],
  shoulderPress: ['Shoulders', 'Triceps'],
  lateralRaise: ['Side Delts'],
  plank: ['Core'],
  // planned:
  deadlift: ['Hamstrings', 'Glutes', 'Lower Back', 'Quads'],
  rdl: ['Hamstrings', 'Glutes', 'Lower Back'],
  benchPress: ['Chest', 'Shoulders', 'Triceps'],
  lunge: ['Quads', 'Glutes', 'Hamstrings'],
  row: ['Lats', 'Upper Back', 'Biceps'],
};

export function musclesFor(exercise: string): string[] {
  return MUSCLE_MAP[exercise] ?? [];
}
