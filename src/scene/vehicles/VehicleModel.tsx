import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { VEHICLE_SPECS } from '../../config/vehicles';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import type { VehicleEntity } from '../../types/game';
import { getNightFactor, resolveEffectiveTime } from '../LightingAndSky';

interface VehicleModelProps {
  vehicleId: string;
  initial: VehicleEntity;
}

export function VehicleModel({ vehicleId, initial }: VehicleModelProps) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyBounceRef = useRef<THREE.Group>(null);
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const dirtGroupRef = useRef<THREE.Group>(null);
  const foamGroupRef = useRef<THREE.Group>(null);

  const sharedMats = useMemo(() => {
    const headlight = new THREE.MeshStandardMaterial({
      color: '#FFFBEB',
      emissive: '#FEF08A',
      emissiveIntensity: 0.8,
    });
    const taillight = new THREE.MeshStandardMaterial({
      color: '#EF4444',
      emissive: '#FF2E4D',
      emissiveIntensity: 1.0,
    });
    const dirt = new THREE.MeshStandardMaterial({
      color: '#6B4F35',
      roughness: 0.98,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
    });
    const foam = new THREE.MeshStandardMaterial({
      color: '#F2FAFF',
      emissive: '#BAE6FD',
      emissiveIntensity: 0.18,
      roughness: 0.6,
      transparent: true,
      opacity: 0.88,
    });
    return { headlight, taillight, dirt, foam };
  }, []);

  useEffect(() => {
    return () => {
      sharedMats.headlight.dispose();
      sharedMats.taillight.dispose();
      sharedMats.dirt.dispose();
      sharedMats.foam.dispose();
    };
  }, [sharedMats]);

  const flSteerRef = useRef<THREE.Group>(null);
  const frSteerRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<Array<THREE.Group | null>>([null, null, null, null]);

  const isSelected = useGameStore(
    (s) => s.selection?.type === 'vehicle' && s.selection.id === vehicleId
  );
  const setSelection = useGameStore((s) => s.setSelection);

  const spec = VEHICLE_SPECS[initial.category];
  const { length, width, wheelRadius, wheelbase, trackWidth } = spec.dimensions;
  const halfTrack = trackWidth / 2;
  const halfBase = wheelbase / 2;

  // Compute distinct geometric proportions per vehicle class
  const shape = useMemo(() => {
    switch (initial.category) {
      case 'budget':
        return {
          bodyH: 0.56,
          bodyY: wheelRadius + 0.24,
          cabinLen: length * 0.54,
          cabinH: 0.56,
          cabinW: width * 0.86,
          cabinZ: -0.18,
          hasSpoiler: false,
          hasRoofRails: false,
          hasSpareTire: false,
          hasStripe: false,
          chromeTrim: false,
        };
      case 'hatchback':
        return {
          bodyH: 0.56,
          bodyY: wheelRadius + 0.24,
          cabinLen: length * 0.58,
          cabinH: 0.54,
          cabinW: width * 0.87,
          cabinZ: -0.24,
          hasSpoiler: true,
          hasRoofRails: false,
          hasSpareTire: false,
          hasStripe: false,
          chromeTrim: false,
        };
      case 'sedan':
        return {
          bodyH: 0.54,
          bodyY: wheelRadius + 0.24,
          cabinLen: length * 0.48,
          cabinH: 0.5,
          cabinW: width * 0.85,
          cabinZ: -0.1,
          hasSpoiler: false,
          hasRoofRails: false,
          hasSpareTire: false,
          hasStripe: false,
          chromeTrim: true,
        };
      case 'suv':
        return {
          bodyH: 0.72,
          bodyY: wheelRadius + 0.34,
          cabinLen: length * 0.64,
          cabinH: 0.68,
          cabinW: width * 0.9,
          cabinZ: -0.25,
          hasSpoiler: false,
          hasRoofRails: true,
          hasSpareTire: true,
          hasStripe: false,
          chromeTrim: false,
        };
      case 'sports':
        return {
          bodyH: 0.44,
          bodyY: wheelRadius + 0.16,
          cabinLen: length * 0.44,
          cabinH: 0.4,
          cabinW: width * 0.82,
          cabinZ: -0.18,
          hasSpoiler: true,
          hasRoofRails: false,
          hasSpareTire: false,
          hasStripe: true,
          chromeTrim: false,
        };
      case 'premium':
        return {
          bodyH: 0.58,
          bodyY: wheelRadius + 0.25,
          cabinLen: length * 0.52,
          cabinH: 0.5,
          cabinW: width * 0.86,
          cabinZ: -0.12,
          hasSpoiler: false,
          hasRoofRails: false,
          hasSpareTire: false,
          hasStripe: false,
          chromeTrim: true,
        };
    }
  }, [initial.category, length, width, wheelRadius]);

  // Procedural mud/dirt patch positions unique per car
  const dirtPatches = useMemo(() => {
    const patches: Array<{ pos: [number, number, number]; scale: [number, number, number] }> = [
      // Left & right rocker panels (heavy road splash)
      { pos: [-width * 0.505, shape.bodyY - 0.08, 0.35], scale: [0.04, 0.32, length * 0.42] },
      { pos: [-width * 0.505, shape.bodyY - 0.1, -0.55], scale: [0.04, 0.28, length * 0.34] },
      { pos: [width * 0.505, shape.bodyY - 0.08, 0.35], scale: [0.04, 0.32, length * 0.42] },
      { pos: [width * 0.505, shape.bodyY - 0.1, -0.55], scale: [0.04, 0.28, length * 0.34] },
      // Hood grime
      { pos: [0.18, shape.bodyY + shape.bodyH * 0.51, length * 0.26], scale: [width * 0.55, 0.04, length * 0.26] },
      // Rear bumper mud
      { pos: [0, shape.bodyY - 0.05, -length * 0.505], scale: [width * 0.78, 0.28, 0.04] },
      // Roof dust
      { pos: [-0.12, shape.bodyY + shape.bodyH * 0.5 + shape.cabinH + 0.02, shape.cabinZ], scale: [shape.cabinW * 0.65, 0.04, shape.cabinLen * 0.6] },
    ];
    return patches;
  }, [width, length, shape]);

  // Snow foam puffy blob positions clinging to vehicle surfaces
  const foamBlobs = useMemo(() => {
    const roofY = shape.bodyY + shape.bodyH * 0.5 + shape.cabinH + 0.05;
    const hoodY = shape.bodyY + shape.bodyH * 0.5 + 0.06;
    const blobs: Array<{ pos: [number, number, number]; r: number }> = [
      { pos: [0, roofY, shape.cabinZ], r: 0.46 },
      { pos: [-0.42, roofY - 0.04, shape.cabinZ + 0.35], r: 0.36 },
      { pos: [0.42, roofY - 0.04, shape.cabinZ - 0.35], r: 0.38 },
      { pos: [0, hoodY, length * 0.28], r: 0.44 },
      { pos: [-0.46, hoodY - 0.05, length * 0.22], r: 0.32 },
      { pos: [0.46, hoodY - 0.05, length * 0.22], r: 0.32 },
      { pos: [-width * 0.48, shape.bodyY + 0.06, 0.2], r: 0.32 },
      { pos: [width * 0.48, shape.bodyY + 0.06, -0.2], r: 0.32 },
      { pos: [0, hoodY, -length * 0.34], r: 0.36 },
    ];
    return blobs;
  }, [length, width, shape]);

  useFrame((clockState) => {
    const car = gameSimulation.vehicles.find((v) => v.id === vehicleId);
    if (!car || !rootRef.current) return;

    rootRef.current.position.set(car.x, car.y, car.z);
    rootRef.current.rotation.y = car.rotationY;

    // Subtle driving suspension vibration & engine idle tremor
    if (bodyBounceRef.current) {
      const t = clockState.clock.elapsedTime;
      const bounce =
        car.speed > 0.3
          ? Math.sin(t * 16 + car.appearance.dirtSeed) * 0.018
          : Math.sin(t * 9 + car.appearance.dirtSeed) * 0.005;
      bodyBounceRef.current.position.y = bounce;
      bodyBounceRef.current.rotation.x = car.braking && car.speed > 0.4 ? 0.025 : 0;
    }

    // Rotate 4 wheels + steer front pair
    if (flSteerRef.current) flSteerRef.current.rotation.y = car.steerAngle;
    if (frSteerRef.current) frSteerRef.current.rotation.y = car.steerAngle;
    for (let i = 0; i < 4; i++) {
      const w = wheelRefs.current[i];
      if (w) w.rotation.x = car.wheelSpin;
    }

    // Dynamic paint cleanliness transition: dusty matte -> mirror showroom clearcoat!
    if (bodyMatRef.current) {
      bodyMatRef.current.roughness = THREE.MathUtils.lerp(0.14, 0.86, car.dirtLevel);
      bodyMatRef.current.metalness = THREE.MathUtils.lerp(0.42, 0.06, car.dirtLevel);
    }

    // Dynamic dirt patch visibility across all patches simultaneously
    if (dirtGroupRef.current) {
      const vis = car.dirtLevel > 0.02;
      dirtGroupRef.current.visible = vis;
      sharedMats.dirt.opacity = Math.min(0.88, car.dirtLevel * 0.92);
    }

    // Dynamic snow foam coverage across all blobs simultaneously
    if (foamGroupRef.current) {
      const vis = car.foamLevel > 0.03;
      foamGroupRef.current.visible = vis;
      const s = 0.35 + car.foamLevel * 0.72;
      foamGroupRef.current.scale.set(1, s, 1);
      sharedMats.foam.opacity = Math.min(0.92, car.foamLevel * 0.95);
    }

    // Headlights at dusk/night & brake lights when braking/stopped
    const store = useGameStore.getState();
    const effTime = resolveEffectiveTime(store.timeOfDay, store.settings.timeMode);
    const night = getNightFactor(effTime);
    sharedMats.headlight.emissiveIntensity = 0.55 + night * 2.6;
    sharedMats.taillight.emissiveIntensity = car.braking ? 2.6 : 0.7 + night * 0.9;
  });

  const cabinY = shape.bodyY + shape.bodyH * 0.5 + shape.cabinH * 0.48;

  return (
    <group
      ref={rootRef}
      position={[initial.x, initial.y, initial.z]}
      rotation={[0, initial.rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        setSelection({ type: 'vehicle', id: vehicleId });
      }}
    >
      {/* Ground Selection Ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
          <ringGeometry args={[length * 0.52, length * 0.58, 28]} />
          <meshBasicMaterial color="#00D4FF" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Animated Chassis Group */}
      <group ref={bodyBounceRef}>
        {/* Main Sculpted Lower Body */}
        <mesh position={[0, shape.bodyY, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, shape.bodyH, length]} />
          <meshStandardMaterial
            ref={bodyMatRef}
            color={initial.appearance.primaryColor}
            roughness={0.8}
            metalness={0.12}
          />
        </mesh>

        {/* Lower Front & Rear Bumpers / Skirt Trim */}
        <mesh position={[0, shape.bodyY - shape.bodyH * 0.36, length * 0.49]} castShadow>
          <boxGeometry args={[width * 0.98, 0.2, 0.16]} />
          <meshStandardMaterial color={initial.appearance.accentColor} roughness={0.55} />
        </mesh>
        <mesh position={[0, shape.bodyY - shape.bodyH * 0.36, -length * 0.49]} castShadow>
          <boxGeometry args={[width * 0.98, 0.2, 0.16]} />
          <meshStandardMaterial color={initial.appearance.accentColor} roughness={0.55} />
        </mesh>

        {/* Front Grille */}
        <mesh position={[0, shape.bodyY - 0.04, length * 0.504]}>
          <boxGeometry args={[width * 0.52, shape.bodyH * 0.42, 0.04]} />
          <meshStandardMaterial
            color={shape.chromeTrim ? '#DCE3EE' : '#161A24'}
            metalness={shape.chromeTrim ? 0.8 : 0.3}
            roughness={0.35}
          />
        </mesh>

        {/* Cabin Greenhouse & Roof */}
        <mesh position={[0, cabinY, shape.cabinZ]} castShadow receiveShadow>
          <boxGeometry args={[shape.cabinW, shape.cabinH, shape.cabinLen]} />
          <meshStandardMaterial
            color={initial.appearance.primaryColor}
            roughness={0.35}
            metalness={0.22}
          />
        </mesh>

        {/* Stylized Tinted Windshield, Rear Window & Side Glass */}
        <mesh position={[0, cabinY + 0.02, shape.cabinZ + shape.cabinLen * 0.504]}>
          <planeGeometry args={[shape.cabinW * 0.88, shape.cabinH * 0.78]} />
          <meshStandardMaterial color="#18273F" roughness={0.1} metalness={0.65} />
        </mesh>
        <mesh
          position={[0, cabinY + 0.02, shape.cabinZ - shape.cabinLen * 0.504]}
          rotation={[0, Math.PI, 0]}
        >
          <planeGeometry args={[shape.cabinW * 0.84, shape.cabinH * 0.72]} />
          <meshStandardMaterial color="#18273F" roughness={0.1} metalness={0.65} />
        </mesh>
        <mesh
          position={[-shape.cabinW * 0.504, cabinY + 0.03, shape.cabinZ]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <planeGeometry args={[shape.cabinLen * 0.82, shape.cabinH * 0.68]} />
          <meshStandardMaterial color="#1B2C47" roughness={0.12} metalness={0.6} />
        </mesh>
        <mesh
          position={[shape.cabinW * 0.504, cabinY + 0.03, shape.cabinZ]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[shape.cabinLen * 0.82, shape.cabinH * 0.68]} />
          <meshStandardMaterial color="#1B2C47" roughness={0.12} metalness={0.6} />
        </mesh>

        {/* Side Mirrors */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * (width * 0.52), shape.bodyY + shape.bodyH * 0.52, shape.cabinZ + shape.cabinLen * 0.35]}
          >
            <boxGeometry args={[0.16, 0.1, 0.14]} />
            <meshStandardMaterial color={initial.appearance.accentColor} roughness={0.4} />
          </mesh>
        ))}

        {/* Sports Racing Stripe */}
        {shape.hasStripe && (
          <mesh position={[0, shape.bodyY + shape.bodyH * 0.505, length * 0.18]}>
            <boxGeometry args={[0.32, 0.02, length * 0.62]} />
            <meshStandardMaterial color={initial.appearance.accentColor} roughness={0.3} />
          </mesh>
        )}

        {/* Sports / Hatchback Rear Wing Spoiler */}
        {shape.hasSpoiler && (
          <group position={[0, shape.bodyY + shape.bodyH * 0.5 + 0.2, -length * 0.44]}>
            <mesh position={[-width * 0.32, -0.08, 0]}>
              <boxGeometry args={[0.08, 0.22, 0.16]} />
              <meshStandardMaterial color={initial.appearance.accentColor} />
            </mesh>
            <mesh position={[width * 0.32, -0.08, 0]}>
              <boxGeometry args={[0.08, 0.22, 0.16]} />
              <meshStandardMaterial color={initial.appearance.accentColor} />
            </mesh>
            <mesh castShadow>
              <boxGeometry args={[width * 0.92, 0.08, 0.28]} />
              <meshStandardMaterial color={initial.appearance.accentColor} roughness={0.3} />
            </mesh>
          </group>
        )}

        {/* SUV Roof Rails & Rear Mounted Spare Tire */}
        {shape.hasRoofRails && (
          <group>
            {[-shape.cabinW * 0.42, shape.cabinW * 0.42].map((rx) => (
              <mesh
                key={rx}
                position={[rx, cabinY + shape.cabinH * 0.5 + 0.08, shape.cabinZ]}
              >
                <boxGeometry args={[0.08, 0.09, shape.cabinLen * 0.84]} />
                <meshStandardMaterial color="#1E2430" metalness={0.6} roughness={0.4} />
              </mesh>
            ))}
          </group>
        )}
        {shape.hasSpareTire && (
          <mesh
            position={[0, shape.bodyY + 0.18, -length * 0.54]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.38, 0.38, 0.24, 12]} />
            <meshStandardMaterial color="#181C24" roughness={0.85} />
          </mesh>
        )}

        {/* Headlights & Taillights */}
        {[-width * 0.34, width * 0.34].map((lx) => (
          <group key={lx}>
            <mesh position={[lx, shape.bodyY + 0.05, length * 0.505]} material={sharedMats.headlight}>
              <boxGeometry args={[0.34, 0.15, 0.04]} />
            </mesh>
            <mesh position={[lx, shape.bodyY + 0.06, -length * 0.505]} material={sharedMats.taillight}>
              <boxGeometry args={[0.36, 0.14, 0.04]} />
            </mesh>
          </group>
        ))}

        {/* Dynamic Dirt & Mud Splatter Layer (fades away as car gets washed!) */}
        <group ref={dirtGroupRef}>
          {dirtPatches.map((p, idx) => (
            <mesh key={idx} position={p.pos} material={sharedMats.dirt}>
              <boxGeometry args={p.scale} />
            </mesh>
          ))}
        </group>

        {/* Dynamic Snow Foam Layer (puffs up during foam stage, washes off during scrub!) */}
        <group ref={foamGroupRef} visible={false}>
          {foamBlobs.map((b, idx) => (
            <mesh key={idx} position={b.pos} material={sharedMats.foam}>
              <dodecahedronGeometry args={[b.r, 1]} />
            </mesh>
          ))}
        </group>
      </group>

      {/* 4 Articulated Rotating Wheels (Front Pair Steers!) */}
      {[
        { pos: [-halfTrack, wheelRadius, halfBase] as [number, number, number], front: true, steerRef: flSteerRef, idx: 0 },
        { pos: [halfTrack, wheelRadius, halfBase] as [number, number, number], front: true, steerRef: frSteerRef, idx: 1 },
        { pos: [-halfTrack, wheelRadius, -halfBase] as [number, number, number], front: false, steerRef: null, idx: 2 },
        { pos: [halfTrack, wheelRadius, -halfBase] as [number, number, number], front: false, steerRef: null, idx: 3 },
      ].map((w) => (
        <group key={w.idx} position={w.pos} ref={w.steerRef ?? undefined}>
          <group
            ref={(el) => {
              wheelRefs.current[w.idx] = el;
            }}
          >
            {/* Tire */}
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[wheelRadius, wheelRadius, 0.26, 12]} />
              <meshStandardMaterial color="#151821" roughness={0.88} />
            </mesh>
            {/* Rim Hub */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[wheelRadius * 0.62, wheelRadius * 0.62, 0.28, 8]} />
              <meshStandardMaterial
                color={initial.appearance.rimColor}
                metalness={0.75}
                roughness={0.28}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
