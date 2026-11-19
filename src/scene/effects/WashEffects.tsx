import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
}

const WATER_COUNT = 180;
const FOAM_COUNT = 120;
const SPARKLE_COUNT = 70;

function createPool(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    active: false,
    x: 0,
    y: -20,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 0,
    life: 1,
    size: 0.1,
  }));
}

export function WashEffects() {
  const waterMeshRef = useRef<THREE.InstancedMesh>(null);
  const foamMeshRef = useRef<THREE.InstancedMesh>(null);
  const sparkleMeshRef = useRef<THREE.InstancedMesh>(null);

  const waterPool = useMemo(() => createPool(WATER_COUNT), []);
  const foamPool = useMemo(() => createPool(FOAM_COUNT), []);
  const sparklePool = useMemo(() => createPool(SPARKLE_COUNT), []);

  const waterCursor = useRef(0);
  const foamCursor = useRef(0);
  const sparkleCursor = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const spawnInPool = (
    pool: Particle[],
    cursorRef: { current: number },
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number
  ) => {
    const p = pool[cursorRef.current % pool.length];
    cursorRef.current = (cursorRef.current + 1) % pool.length;
    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.age = 0;
    p.life = life;
    p.size = size;
  };

  useFrame((_, rawDt) => {
    const state = useGameStore.getState();
    const speedMul = state.paused ? 0 : state.simSpeed;
    const dt = Math.min(rawDt, 0.05) * Math.max(0.2, speedMul);
    const qualityFactor = state.settings.quality === 'low' ? 0.45 : state.settings.quality === 'medium' ? 0.75 : 1.0;

    if (!state.paused) {
      // 1. Emit pressurized water jets & snow foam from every active washing worker!
      for (const rt of gameSimulation.workerRuntimes.values()) {
        if (!rt.sprayTarget) continue;
        const nozzleX = rt.x + Math.sin(rt.rotationY) * 0.85;
        const nozzleY = 1.25;
        const nozzleZ = rt.z + Math.cos(rt.rotationY) * 0.85;

        const dx = rt.sprayTarget.x - nozzleX;
        const dy = rt.sprayTarget.y - nozzleY;
        const dz = rt.sprayTarget.z - nozzleZ;

        if (rt.action === 'rinsing') {
          const count = Math.max(1, Math.round(4 * qualityFactor));
          for (let i = 0; i < count; i++) {
            const spread = 0.28;
            spawnInPool(
              waterPool,
              waterCursor,
              nozzleX,
              nozzleY,
              nozzleZ,
              dx * 3.1 + (Math.random() - 0.5) * spread,
              dy * 3.1 + 0.4 + (Math.random() - 0.5) * spread,
              dz * 3.1 + (Math.random() - 0.5) * spread,
              0.38 + Math.random() * 0.16,
              0.08 + Math.random() * 0.05
            );
          }
          // Splash mist bounce off the car surface
          if (Math.random() < 0.7 * qualityFactor) {
            spawnInPool(
              waterPool,
              waterCursor,
              rt.sprayTarget.x + (Math.random() - 0.5) * 0.5,
              rt.sprayTarget.y + 0.15,
              rt.sprayTarget.z + (Math.random() - 0.5) * 0.5,
              (Math.random() - 0.5) * 2.2,
              1.4 + Math.random() * 1.4,
              (Math.random() - 0.5) * 2.2,
              0.42,
              0.09
            );
          }
        } else if (rt.action === 'foaming') {
          const count = Math.max(1, Math.round(3 * qualityFactor));
          for (let i = 0; i < count; i++) {
            spawnInPool(
              foamPool,
              foamCursor,
              nozzleX,
              nozzleY,
              nozzleZ,
              dx * 2.1 + (Math.random() - 0.5) * 0.65,
              dy * 2.1 + 0.6 + (Math.random() - 0.5) * 0.5,
              dz * 2.1 + (Math.random() - 0.5) * 0.65,
              0.72 + Math.random() * 0.35,
              0.15 + Math.random() * 0.12
            );
          }
        } else if (rt.action === 'scrubbing' && Math.random() < 0.55 * qualityFactor) {
          spawnInPool(
            foamPool,
            foamCursor,
            rt.sprayTarget.x + (Math.random() - 0.5) * 0.8,
            rt.sprayTarget.y + 0.25,
            rt.sprayTarget.z + (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.9,
            0.9 + Math.random() * 0.8,
            (Math.random() - 0.5) * 0.9,
            0.85,
            0.14 + Math.random() * 0.09
          );
        }
      }

      // 2. Emit clean gloss sparkles on drying & newly sparkling vehicles!
      for (const car of gameSimulation.vehicles) {
        if ((car.washStage === 'dry' || car.sparkleTimer > 0) && Math.random() < 0.45 * qualityFactor) {
          spawnInPool(
            sparklePool,
            sparkleCursor,
            car.x + (Math.random() - 0.5) * 2.1,
            0.85 + Math.random() * 1.1,
            car.z + (Math.random() - 0.5) * 3.4,
            (Math.random() - 0.5) * 0.35,
            0.95 + Math.random() * 0.6,
            (Math.random() - 0.5) * 0.35,
            0.65 + Math.random() * 0.3,
            0.14 + Math.random() * 0.08
          );
        }
      }
    }

    // Step & upload water particles
    if (waterMeshRef.current) {
      for (let i = 0; i < WATER_COUNT; i++) {
        const p = waterPool[i];
        if (p.active) {
          p.age += dt;
          if (p.age >= p.life || p.y < 0.05) {
            p.active = false;
            dummy.scale.set(0, 0, 0);
          } else {
            p.vy -= 7.2 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            const s = p.size * (1 - p.age / p.life * 0.45);
            dummy.position.set(p.x, p.y, p.z);
            dummy.scale.set(s, s * 1.3, s);
            dummy.rotation.set(p.age * 4, p.age * 3, 0);
          }
        } else {
          dummy.position.set(0, -25, 0);
          dummy.scale.set(0, 0, 0);
        }
        dummy.updateMatrix();
        waterMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      waterMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // Step & upload foam clouds
    if (foamMeshRef.current) {
      for (let i = 0; i < FOAM_COUNT; i++) {
        const p = foamPool[i];
        if (p.active) {
          p.age += dt;
          if (p.age >= p.life) {
            p.active = false;
            dummy.scale.set(0, 0, 0);
          } else {
            p.vy -= 1.6 * dt;
            p.vx *= 0.96;
            p.vz *= 0.96;
            p.x += p.vx * dt;
            p.y = Math.max(0.12, p.y + p.vy * dt);
            p.z += p.vz * dt;
            const progress = p.age / p.life;
            const envelope = progress < 0.25 ? progress / 0.25 : 1 - (progress - 0.25) / 0.75;
            const s = p.size * (0.6 + envelope * 0.95);
            dummy.position.set(p.x, p.y, p.z);
            dummy.scale.set(s, s, s);
            dummy.rotation.set(p.age, p.age * 1.4, 0);
          }
        } else {
          dummy.position.set(0, -25, 0);
          dummy.scale.set(0, 0, 0);
        }
        dummy.updateMatrix();
        foamMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      foamMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // Step & upload clean sparkles
    if (sparkleMeshRef.current) {
      for (let i = 0; i < SPARKLE_COUNT; i++) {
        const p = sparklePool[i];
        if (p.active) {
          p.age += dt;
          if (p.age >= p.life) {
            p.active = false;
            dummy.scale.set(0, 0, 0);
          } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            const env = Math.sin((p.age / p.life) * Math.PI);
            const s = p.size * env;
            dummy.position.set(p.x, p.y, p.z);
            dummy.scale.set(s, s, s);
            dummy.rotation.set(p.age * 5, p.age * 6, p.age * 4);
          }
        } else {
          dummy.position.set(0, -25, 0);
          dummy.scale.set(0, 0, 0);
        }
        dummy.updateMatrix();
        sparkleMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      sparkleMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Pressurized Water Droplets & Splash Mist */}
      <instancedMesh ref={waterMeshRef} args={[undefined, undefined, WATER_COUNT]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#7DD3FC"
          emissive="#38BDF8"
          emissiveIntensity={0.65}
          transparent
          opacity={0.82}
          roughness={0.15}
        />
      </instancedMesh>

      {/* Stylized Snow Foam Puffs */}
      <instancedMesh ref={foamMeshRef} args={[undefined, undefined, FOAM_COUNT]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#F8FDFF"
          emissive="#E0F2FE"
          emissiveIntensity={0.28}
          transparent
          opacity={0.9}
          roughness={0.55}
        />
      </instancedMesh>

      {/* Clean Gloss Sparkles */}
      <instancedMesh ref={sparkleMeshRef} args={[undefined, undefined, SPARKLE_COUNT]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#FFF7B2"
          emissive="#FFD700"
          emissiveIntensity={1.9}
          roughness={0.1}
        />
      </instancedMesh>
    </group>
  );
}
