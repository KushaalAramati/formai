'use client';

import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { ActivationMap, MuscleState } from '@/lib/anatomy/activation';
import type { MuscleId } from '@/lib/anatomy/muscles';

const MODEL = '/models/lower-limb.glb';
useGLTF.preload(MODEL);

const STATE_COLOR: Record<MuscleState, string> = {
  primary: '#16a34a',
  secondary: '#0d9488',
  underactive: '#f59e0b',
  compensating: '#ef4444',
  idle: '#b06b60',
};
const IDLE_MUSCLE = '#b06b60'; // neutral fleshy tone
const BONE = '#ddd6c8';
const HIDE_GROUPS = ['Cartilages', 'Ligaments', 'Fascia', 'Arteries', 'Veins', 'Nerves', 'Bursae', 'Overlays'];

// Muscle mesh name -> our muscle group id.
const NAME_MAP: [RegExp, MuscleId][] = [
  [/rectus femoris|vastus/i, 'quads'],
  [/gluteus/i, 'glutes'],
  [/biceps femoris|semitendinosus|semimembranosus/i, 'hamstrings'],
  [/adductor (brevis|longus|magnus|minimus)|gracilis/i, 'adductors'],
  [/gastrocnemius|soleus/i, 'calves'],
];
function muscleIdFor(name: string): MuscleId | null {
  if (/hallucis|digitorum|canal|hiatus/i.test(name)) return null; // foot / non-target
  for (const [re, id] of NAME_MAP) if (re.test(name)) return id;
  return null;
}

function Model({ activation }: { activation: ActivationMap }) {
  const { scene } = useGLTF(MODEL);

  const { root, byId } = useMemo(() => {
    const root = scene.clone(true);
    const byId: Partial<Record<MuscleId, THREE.MeshStandardMaterial[]>> = {};

    // hide non-muscle/bone groups
    for (const child of root.children) {
      if (HIDE_GROUPS.includes(child.name)) child.visible = false;
    }

    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // which top-level group is this under?
      let top: THREE.Object3D | null = mesh;
      while (top && top.parent && top.parent !== root) top = top.parent;
      const groupName = top?.name ?? '';

      if (groupName === 'Bones') {
        mesh.material = new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.95, transparent: true, opacity: 0.5 });
        return;
      }
      if (groupName === 'Muscles') {
        // resolve muscle id from self or ancestors
        let id: MuscleId | null = null;
        let p: THREE.Object3D | null = mesh;
        while (p && !id && p !== root) {
          id = muscleIdFor(p.name);
          p = p.parent;
        }
        const mat = new THREE.MeshStandardMaterial({ color: IDLE_MUSCLE, roughness: 0.55 });
        mesh.material = mat;
        if (id) (byId[id] ??= []).push(mat);
      }
    });

    // center + scale to fit regardless of source units/orientation
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 2.7 / maxDim;
    root.scale.setScalar(s);
    root.position.set(-center.x * s, -center.y * s, -center.z * s);

    return { root, byId };
  }, [scene]);

  useEffect(() => {
    // reset to idle
    for (const mats of Object.values(byId)) {
      for (const m of mats!) {
        m.color.set(IDLE_MUSCLE);
        m.emissive.set('#000000');
        m.emissiveIntensity = 0;
      }
    }
    // apply activation
    for (const key of Object.keys(activation) as MuscleId[]) {
      const a = activation[key];
      const mats = byId[key];
      if (!a || !mats) continue;
      const col = STATE_COLOR[a.state];
      for (const m of mats) {
        m.color.set(col);
        m.emissive.set(col);
        m.emissiveIntensity = 0.25 + a.intensity * 0.6;
      }
    }
  }, [activation, byId]);

  return <primitive object={root} />;
}

export default function RealAnatomyViewer({ activation }: { activation: ActivationMap }) {
  return (
    <div style={{ width: '100%', height: 340, borderRadius: 16, overflow: 'hidden', background: '#0c1118' }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 42 }} dpr={[1, 2]}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} />
        <directionalLight position={[-4, 1, -3]} intensity={0.5} />
        <Model activation={activation} />
        <OrbitControls autoRotate autoRotateSpeed={2} enablePan={false} enableZoom={true} minDistance={2.2} maxDistance={7} />
      </Canvas>
    </div>
  );
}
