import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ROAD_Z } from '../../config/worldLayout';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import { getNightFactor, resolveEffectiveTime } from '../LightingAndSky';

interface AmbientCar {
  id: string;
  x: number;
  z: number;
  dir: 1 | -1;
  speed: number;
  color: string;
}

const INITIAL_AMBIENT_CARS: AmbientCar[] = [
  { id: 'amb-1', x: -48, z: ROAD_Z.southLane, dir: 1, speed: 12.5, color: '#F59E0B' },
  { id: 'amb-2', x: 10, z: ROAD_Z.southLane, dir: 1, speed: 13.5, color: '#38BDF8' },
  { id: 'amb-3', x: 46, z: ROAD_Z.northLane, dir: -1, speed: 12.0, color: '#E2E8F0' },
  { id: 'amb-4', x: -16, z: ROAD_Z.northLane, dir: -1, speed: 13.0, color: '#EF4444' },
];

export function AmbientTraffic() {
  const carsRef = useRef<AmbientCar[]>(INITIAL_AMBIENT_CARS.map((c) => ({ ...c })));
  const groupRefs = useRef<Array<THREE.Group | null>>([]);

  const headlightMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#FFFBEB',
        emissive: '#FEF08A',
        emissiveIntensity: 0.8,
      }),
    []
  );

  useEffect(() => {
    return () => {
      headlightMat.dispose();
    };
  }, [headlightMat]);

  useFrame((_, rawDt) => {
    const state = useGameStore.getState();
    const speedMul = state.paused ? 0 : state.simSpeed;
    const dt = Math.min(rawDt, 0.05) * speedMul;
    const t = resolveEffectiveTime(state.timeOfDay, state.settings.timeMode);
    const night = getNightFactor(t);
    headlightMat.emissiveIntensity = 0.5 + night * 2.5;

    carsRef.current.forEach((car, i) => {
      let blocked = false;
      for (const v of gameSimulation.vehicles) {
        if (Math.abs(v.z - car.z) > 2.2) continue;
        const ahead = (v.x - car.x) * car.dir;
        if (ahead > 0 && ahead < 7.2) {
          blocked = true;
          break;
        }
      }

      if (!blocked && dt > 0) {
        car.x += car.dir * car.speed * dt;
        if (car.dir === 1 && car.x > 64) {
          car.x = -64 - Math.random() * 14;
        } else if (car.dir === -1 && car.x < -64) {
          car.x = 64 + Math.random() * 14;
        }
      }

      const grp = groupRefs.current[i];
      if (grp) {
        grp.position.set(car.x, 0.05, car.z);
        grp.rotation.y = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }
    });
  });

  return (
    <group>
      {INITIAL_AMBIENT_CARS.map((car, idx) => (
        <group
          key={car.id}
          ref={(el) => {
            groupRefs.current[idx] = el;
          }}
          position={[car.x, 0.05, car.z]}
        >
          <mesh position={[0, 0.56, 0]} castShadow>
            <boxGeometry args={[1.76, 0.62, 4.0]} />
            <meshStandardMaterial color={car.color} roughness={0.35} metalness={0.25} />
          </mesh>
          <mesh position={[0, 1.08, -0.15]} castShadow>
            <boxGeometry args={[1.5, 0.52, 2.05]} />
            <meshStandardMaterial color="#182234" roughness={0.18} metalness={0.4} />
          </mesh>
          {[
            [-0.82, 0.34, 1.25],
            [0.82, 0.34, 1.25],
            [-0.82, 0.34, -1.25],
            [0.82, 0.34, -1.25],
          ].map(([wx, wy, wz], wi) => (
            <mesh key={wi} position={[wx, wy, wz]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.34, 0.34, 0.24, 10]} />
              <meshStandardMaterial color="#151820" roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[-0.58, 0.58, 2.01]} material={headlightMat}>
            <boxGeometry args={[0.34, 0.16, 0.05]} />
          </mesh>
          <mesh position={[0.58, 0.58, 2.01]} material={headlightMat}>
            <boxGeometry args={[0.34, 0.16, 0.05]} />
          </mesh>
          <mesh position={[-0.58, 0.58, -2.01]}>
            <boxGeometry args={[0.34, 0.16, 0.05]} />
            <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={1.2} />
          </mesh>
          <mesh position={[0.58, 0.58, -2.01]}>
            <boxGeometry args={[0.34, 0.16, 0.05]} />
            <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
