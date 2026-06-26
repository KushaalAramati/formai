'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MUSCLES, MUSCLE_IDS, type MuscleId } from '@/lib/anatomy/muscles';
import type { ActivationMap, MuscleState } from '@/lib/anatomy/activation';

const STATE_COLOR: Record<MuscleState, string> = {
  primary: '#16a34a', // correctly targeted — green
  secondary: '#0d9488', // assisting — teal
  underactive: '#f59e0b', // target you're under-working — amber
  compensating: '#ef4444', // wrongly recruited by a fault — red
  idle: '#39404a', // not involved — neutral
};

function Muscle({ id, act }: { id: MuscleId; act?: ActivationMap[MuscleId] }) {
  const def = MUSCLES[id];
  const state: MuscleState = act?.state ?? 'idle';
  const intensity = act?.intensity ?? 0;
  const color = STATE_COLOR[state];
  const emissive = state === 'idle' ? '#000000' : color;
  const emissiveIntensity = state === 'idle' ? 0 : 0.25 + intensity * 0.75;
  const opacity = state === 'idle' ? 0.35 : 0.9;

  const positions: [number, number, number][] = def.paired
    ? [def.pos, [-def.pos[0], def.pos[1], def.pos[2]]]
    : [def.pos];

  return (
    <>
      {positions.map((p, i) => (
        <mesh key={i} position={p} scale={def.scale}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
            transparent
            opacity={opacity}
            roughness={0.6}
          />
        </mesh>
      ))}
    </>
  );
}

function Body() {
  // Neutral stylized mannequin the muscle blobs sit on.
  const mat = { color: '#11161f', roughness: 0.9, metalness: 0 } as const;
  return (
    <group>
      <mesh position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <capsuleGeometry args={[0.34, 0.7, 8, 16]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.5, 0.6, 0]} rotation={[0, 0, s * 0.1]}>
            <capsuleGeometry args={[0.11, 0.95, 8, 16]} />
            <meshStandardMaterial {...mat} />
          </mesh>
          <mesh position={[s * 0.18, -0.55, 0]}>
            <capsuleGeometry args={[0.16, 1.1, 8, 16]} />
            <meshStandardMaterial {...mat} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function AnatomyViewer({ activation }: { activation: ActivationMap }) {
  return (
    <div style={{ width: '100%', height: 320, borderRadius: 16, overflow: 'hidden', background: '#0c1118' }}>
      <Canvas camera={{ position: [0, 0.2, 3.6], fov: 42 }} dpr={[1, 2]}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <directionalLight position={[-3, 2, -4]} intensity={0.5} />
        <group position={[0, -0.15, 0]}>
          <Body />
          {MUSCLE_IDS.map((id) => (
            <Muscle key={id} id={id} act={activation[id]} />
          ))}
        </group>
        <OrbitControls
          autoRotate
          autoRotateSpeed={2.2}
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 1.7}
        />
      </Canvas>
    </div>
  );
}
