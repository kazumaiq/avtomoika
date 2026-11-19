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

const WATER_COUNT = 220;
const FOAM_COUNT = 140;
const SPARKLE_COUNT = 95;
const BEAM_COUNT = 10;

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
  const beamMeshRef = useRef<THREE.InstancedMesh>(null);

  const waterPool = useMemo(() => createPool(WATER_COUNT), []);
  const foamPool = useMemo(() => createPool(FOAM_COUNT), []);
  const sparklePool = useMemo(() => createPool(SPARKLE_COUNT), []);

  const waterCursor = useRef(0);
  const foamCursor = useRef(0);
  const sparkleCursor = useRef(0);
  const processedBurstTimestamps = useRef<Set<number>>(new Set());

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const vecA = useMemo(() => new THREE.Vector3(), []);
  const vecB = useMemo(() => new THREE.Vector3(), []);
  const vecDir = useMemo(() => new THREE.Vector3(), []);
  const upVec = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const beamColor = useMemo(() => new THREE.Color(), []);

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
    const qualityFactor =
      state.settings.quality === 'low' ? 0.5 : state.settings.quality === 'medium' ? 0.8 : 1.0;

    // Handle dramatic Splash Bursts from Turbo-Boost clicks & VIP completions!
    for (const burst of gameSimulation.pendingBursts) {
      if (processedBurstTimestamps.current.has(burst.createdAt)) continue;
      processedBurstTimestamps.current.add(burst.createdAt);
      if (processedBurstTimestamps.current.size > 40) {
        processedBurstTimestamps.current.clear();
        processedBurstTimestamps.current.add(burst.createdAt);
      }

      const splashCount = Math.round(18 * qualityFactor);
      for (let i = 0; i < splashCount; i++) {
        const ang = (i / splashCount) * Math.PI * 2 + Math.random() * 0.4;
        const spd = 2.0 + Math.random() * 2.8;
        spawnInPool(
          burst.isVip ? sparklePool : waterPool,
          burst.isVip ? sparkleCursor : waterCursor,
          burst.x + (Math.random() - 0.5) * 0.8,
          burst.y + Math.random() * 0.5,
          burst.z + (Math.random() - 0.5) * 1.2,
          Math.cos(ang) * spd,
          2.2 + Math.random() * 2.2,
          Math.sin(ang) * spd,
          0.55 + Math.random() * 0.3,
          burst.isVip ? 0.2 : 0.12
        );
      }
      for (let i = 0; i < 8; i++) {
        spawnInPool(
          sparklePool,
          sparkleCursor,
          burst.x + (Math.random() - 0.5) * 1.6,
          burst.y + 0.5 + Math.random() * 0.8,
          burst.z + (Math.random() - 0.5) * 2.4,
          (Math.random() - 0.5) * 1.4,
          1.6 + Math.random() * 1.4,
          (Math.random() - 0.5) * 1.4,
          0.75,
          0.18
        );
      }
    }

    let beamIdx = 0;

    if (!state.paused) {
      // 1. Emit pressurized water jets, visible spray cones & snow foam from active workers!
      for (const rt of gameSimulation.workerRuntimes.values()) {
        if (!rt.sprayTarget) continue;
        const nozzleX = rt.x + Math.sin(rt.rotationY) * 0.85;
        const nozzleY = 1.26;
        const nozzleZ = rt.z + Math.cos(rt.rotationY) * 0.85;

        const dx = rt.sprayTarget.x - nozzleX;
        const dy = rt.sprayTarget.y - nozzleY;
        const dz = rt.sprayTarget.z - nozzleZ;

        // Visible Pressurized Spray Beam Cone!
        if (
          beamMeshRef.current &&
          beamIdx < BEAM_COUNT &&
          (rt.action === 'rinsing' || rt.action === 'foaming')
        ) {
          vecA.set(nozzleX, nozzleY, nozzleZ);
          vecB.set(rt.sprayTarget.x, rt.sprayTarget.y, rt.sprayTarget.z);
          vecDir.subVectors(vecB, vecA);
          const dist = vecDir.length();
          if (dist > 0.2 && dist < 5.5) {
            dummy.position.copy(vecA).addScaledVector(vecDir, 0.5);
            vecDir.normalize();
            quat.setFromUnitVectors(upVec, vecDir);
            dummy.quaternion.copy(quat);
            const radius = rt.action === 'foaming' ? 0.16 : 0.085;
            dummy.scale.set(radius, dist, radius);
            dummy.updateMatrix();
            beamMeshRef.current.setMatrixAt(beamIdx, dummy.matrix);
            beamColor.set(rt.action === 'foaming' ? '#F0F9FF' : '#38BDF8');
            beamMeshRef.current.setColorAt(beamIdx, beamColor);
            beamIdx++;
          }
        }

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
              0.085 + Math.random() * 0.05
            );
          }
          if (Math.random() < 0.75 * qualityFactor) {
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
              0.095
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
              0.74 + Math.random() * 0.35,
              0.16 + Math.random() * 0.12
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

      // 2. Emit clean gloss sparkles on drying, VIP, & newly washed vehicles!
      for (const car of gameSimulation.vehicles) {
        if (
          (car.washStage === 'dry' || car.sparkleTimer > 0 || car.isVip) &&
          Math.random() < (car.isVip ? 0.55 : 0.45) * qualityFactor
        ) {
          spawnInPool(
            sparklePool,
            sparkleCursor,
            car.x + (Math.random() - 0.5) * 2.1,
            0.85 + Math.random() * 1.15,
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

    // Hide unused spray beams
    if (beamMeshRef.current) {
      for (let i = beamIdx; i < BEAM_COUNT; i++) {
        dummy.position.set(0, -30, 0);
        dummy.scale.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        beamMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      beamMeshRef.current.instanceMatrix.needsUpdate = true;
      if (beamMeshRef.current.instanceColor) {
        beamMeshRef.current.instanceColor.needsUpdate = true;
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
            const s = p.size * (1 - (p.age / p.life) * 0.45);
            dummy.position.set(p.x, p.y, p.z);
            dummy.scale.set(s, s * 1.35, s);
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
      {/* Pressurized Water & Foam Jet Cones */}
      <instancedMesh ref={beamMeshRef} args={[undefined, undefined, BEAM_COUNT]} frustumCulled={false}>
        <cylinderGeometry args={[0.25, 1.0, 1.0, 7, 1, true]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.42}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Pressurized Water Droplets & Splash Mist */}
      <instancedMesh ref={waterMeshRef} args={[undefined, undefined, WATER_COUNT]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#7DD3FC"
          emissive="#38BDF8"
          emissiveIntensity={0.75}
          transparent
          opacity={0.85}
          roughness={0.12}
        />
      </instancedMesh>

      {/* Stylized Snow Foam Puffs */}
      <instancedMesh ref={foamMeshRef} args={[undefined, undefined, FOAM_COUNT]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#F8FDFF"
          emissive="#E0F2FE"
          emissiveIntensity={0.32}
          transparent
          opacity={0.92}
          roughness={0.5}
        />
      </instancedMesh>

      {/* Clean Gloss & VIP Sparkles */}
      <instancedMesh ref={sparkleMeshRef} args={[undefined, undefined, SPARKLE_COUNT]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#FFF7B2"
          emissive="#FFD700"
          emissiveIntensity={2.1}
          roughness={0.08}
        />
      </instancedMesh>
    </group>
  );
}
