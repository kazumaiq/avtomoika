import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COMPETITOR_LAYOUT, PLAYER_LAYOUT } from '../../config/worldLayout';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import type { WashStage } from '../../types/game';

interface BaySlotSpec {
  owner: 'player' | 'competitor';
  bayIndex: number;
  x: number;
  z: number;
}

const BAY_SLOTS: BaySlotSpec[] = [
  ...PLAYER_LAYOUT.bayPositions.map((pos, bayIndex) => ({
    owner: 'player' as const,
    bayIndex,
    x: pos.x,
    z: pos.z,
  })),
  ...COMPETITOR_LAYOUT.bayPositions.map((pos, bayIndex) => ({
    owner: 'competitor' as const,
    bayIndex,
    x: pos.x,
    z: pos.z,
  })),
];

const STAGE_COLOR: Record<WashStage, string> = {
  none: '#94A3B8',
  greeting: '#FFB800',
  rinse: '#38BDF8',
  foam: '#F0F9FF',
  scrub: '#00D4FF',
  dry: '#22C55E',
  done: '#A3E635',
};

const BAR_WIDTH = 2.15;

/**
 * 100% pure WebGL wet puddles + billboarded 3D wash progress bars.
 * Zero DOM/<Html> overlays and zero React state updates per frame -> locked 60 FPS on iOS!
 */
export function WashProgressBars() {
  const { camera } = useThree();

  const puddleRefs = useRef<Array<THREE.Mesh | null>>([]);
  const puddleMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const barGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const barFillRefs = useRef<Array<THREE.Mesh | null>>([]);
  const barFillMatRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const barBorderMatRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([]);

  const sharedGeos = useMemo(() => {
    const puddle = new THREE.CircleGeometry(2.35, 20);
    const border = new THREE.PlaneGeometry(BAR_WIDTH + 0.14, 0.34);
    const track = new THREE.PlaneGeometry(BAR_WIDTH, 0.22);
    const fill = new THREE.PlaneGeometry(BAR_WIDTH, 0.22);
    return { puddle, border, track, fill };
  }, []);

  const sharedTrackMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#0B1222', transparent: true, opacity: 0.9 }),
    []
  );

  useEffect(() => {
    return () => {
      sharedGeos.puddle.dispose();
      sharedGeos.border.dispose();
      sharedGeos.track.dispose();
      sharedGeos.fill.dispose();
      sharedTrackMat.dispose();
    };
  }, [sharedGeos, sharedTrackMat]);

  useFrame(() => {
    const started = useGameStore.getState().started;

    for (let i = 0; i < BAY_SLOTS.length; i++) {
      const slot = BAY_SLOTS[i];
      const car = gameSimulation.getBayVehicle(slot.owner, slot.bayIndex);

      const puddle = puddleRefs.current[i];
      const puddleMat = puddleMatRefs.current[i];
      const barGroup = barGroupRefs.current[i];
      const barFill = barFillRefs.current[i];
      const fillMat = barFillMatRefs.current[i];
      const borderMat = barBorderMatRefs.current[i];

      if (!car) {
        if (puddle) puddle.visible = false;
        if (barGroup) barGroup.visible = false;
        continue;
      }

      if (puddle && puddleMat) {
        puddle.visible = true;
        const s = 0.55 + Math.min(1, car.washProgress * 1.35) * 0.52;
        puddle.scale.set(s, s, 1);
        puddleMat.color.set(
          car.washStage === 'foam' || car.washStage === 'scrub' ? '#DCF2FF' : '#38BDF8'
        );
      }

      if (barGroup && barFill && fillMat && borderMat) {
        barGroup.visible = started;
        if (started) {
          barGroup.quaternion.copy(camera.quaternion);
          const pct = Math.max(0.04, Math.min(1, car.washProgress));
          barFill.scale.set(pct, 1, 1);
          barFill.position.x = -BAR_WIDTH * 0.5 * (1 - pct);
          fillMat.color.set(car.isVip ? '#FACC15' : STAGE_COLOR[car.washStage]);
          borderMat.color.set(
            car.isVip ? '#FACC15' : slot.owner === 'player' ? '#00D4FF' : '#FF4D4F'
          );
        }
      }
    }
  });

  return (
    <group>
      {BAY_SLOTS.map((slot, idx) => (
        <group key={`${slot.owner}-${slot.bayIndex}`} position={[slot.x, 0, slot.z]}>
          {/* Glossy Wet Floor Puddle */}
          <mesh
            ref={(el) => {
              puddleRefs.current[idx] = el;
            }}
            visible={false}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.115, 0]}
            geometry={sharedGeos.puddle}
          >
            <meshStandardMaterial
              ref={(el) => {
                puddleMatRefs.current[idx] = el;
              }}
              color="#38BDF8"
              roughness={0.06}
              metalness={0.55}
              transparent
              opacity={0.36}
              depthWrite={false}
            />
          </mesh>

          {/* Sleek Floating Pure-WebGL 3D Wash Progress Bar */}
          <group
            ref={(el) => {
              barGroupRefs.current[idx] = el;
            }}
            visible={false}
            position={[0, 2.85, 0]}
          >
            <mesh geometry={sharedGeos.border} position={[0, 0, -0.01]}>
              <meshBasicMaterial
                ref={(el) => {
                  barBorderMatRefs.current[idx] = el;
                }}
                color="#00D4FF"
                transparent
                opacity={0.82}
              />
            </mesh>
            <mesh geometry={sharedGeos.track} material={sharedTrackMat} position={[0, 0, 0]} />
            <mesh
              ref={(el) => {
                barFillRefs.current[idx] = el;
              }}
              geometry={sharedGeos.fill}
              position={[0, 0, 0.01]}
            >
              <meshBasicMaterial
                ref={(el) => {
                  barFillMatRefs.current[idx] = el;
                }}
                color="#00D4FF"
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
