// Canonical muscle groups + their approximate 3D positions on a ~3.2-unit-tall stylized body.
// Front of the body faces +z, back faces -z, up is +y, the model is centered near origin.
// Paired muscles (left/right) are rendered twice, mirrored on x.

export type MuscleId =
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'lats'
  | 'traps'
  | 'lowerBack'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export interface MuscleDef {
  label: string;
  /** position of the (right-side) muscle blob; mirrored to -x when paired. */
  pos: [number, number, number];
  /** ellipsoid scale of the blob. */
  scale: [number, number, number];
  /** rendered on both sides of the body. */
  paired: boolean;
}

export const MUSCLES: Record<MuscleId, MuscleDef> = {
  traps: { label: 'Traps', pos: [0, 1.18, -0.16], scale: [0.34, 0.18, 0.14], paired: false },
  frontDelts: { label: 'Front delts', pos: [0.42, 1.02, 0.12], scale: [0.16, 0.16, 0.16], paired: true },
  sideDelts: { label: 'Side delts', pos: [0.5, 1.02, 0], scale: [0.15, 0.16, 0.16], paired: true },
  rearDelts: { label: 'Rear delts', pos: [0.42, 1.02, -0.12], scale: [0.15, 0.15, 0.14], paired: true },
  chest: { label: 'Chest', pos: [0.2, 0.78, 0.2], scale: [0.2, 0.18, 0.14], paired: true },
  lats: { label: 'Lats', pos: [0.3, 0.62, -0.16], scale: [0.16, 0.26, 0.14], paired: true },
  biceps: { label: 'Biceps', pos: [0.52, 0.6, 0.13], scale: [0.12, 0.22, 0.12], paired: true },
  triceps: { label: 'Triceps', pos: [0.52, 0.6, -0.13], scale: [0.12, 0.22, 0.12], paired: true },
  forearms: { label: 'Forearms', pos: [0.58, 0.2, 0.06], scale: [0.11, 0.24, 0.11], paired: true },
  abs: { label: 'Abs', pos: [0, 0.45, 0.22], scale: [0.22, 0.28, 0.12], paired: false },
  obliques: { label: 'Obliques', pos: [0.26, 0.45, 0.14], scale: [0.1, 0.26, 0.12], paired: true },
  lowerBack: { label: 'Lower back', pos: [0, 0.4, -0.2], scale: [0.28, 0.24, 0.12], paired: false },
  glutes: { label: 'Glutes', pos: [0.18, 0.05, -0.2], scale: [0.2, 0.2, 0.16], paired: true },
  quads: { label: 'Quads', pos: [0.18, -0.3, 0.18], scale: [0.18, 0.34, 0.16], paired: true },
  hamstrings: { label: 'Hamstrings', pos: [0.18, -0.3, -0.18], scale: [0.17, 0.34, 0.15], paired: true },
  adductors: { label: 'Adductors', pos: [0.08, -0.32, 0.06], scale: [0.1, 0.3, 0.12], paired: true },
  calves: { label: 'Calves', pos: [0.18, -0.95, -0.12], scale: [0.14, 0.28, 0.13], paired: true },
};

export const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[];
