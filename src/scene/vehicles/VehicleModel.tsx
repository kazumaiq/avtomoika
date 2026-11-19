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
  const roofMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const vipRingRef = useRef<THREE.Mesh>(null);
  const vipStarRef = useRef<THREE.Mesh>(null);

  const dirtGroupRef = useRef<THREE.Group>(null);
  const foamGroupRef = useRef<THREE.Group>(null);

  const sharedMats = useMemo(() => {
    const headlight = new THREE.MeshStandardMaterial({
      color: '#FFFBEB',
      emissive: '#FEF08A',
      emissiveIntensity: 0.9,
    });
    const drl = new THREE.MeshStandardMaterial({
      color: '#E0F7FF',
      emissive: '#38BDF8',
      emissiveIntensity: 1.4,
    });
    const taillight = new THREE.MeshStandardMaterial({
      color: '#EF4444',
      emissive: '#FF2E4D',
      emissiveIntensity: 1.1,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: '#0F2240',
      roughness: 0.05,
      metalness: 0.85,
      envMapIntensity: 1.5,
    });
    const dirt = new THREE.MeshStandardMaterial({
      color: '#63472F',
      roughness: 0.98,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const foam = new THREE.MeshStandardMaterial({
      color: '#F4FBFF',
      emissive: '#BAE6FD',
      emissiveIntensity: 0.22,
      roughness: 0.55,
      transparent: true,
      opacity: 0.9,
    });
    return { headlight, drl, taillight, glass, dirt, foam };
  }, []);

  useEffect(() => {
    return () => {
      sharedMats.headlight.dispose();
      sharedMats.drl.dispose();
      sharedMats.taillight.dispose();
      sharedMats.glass.dispose();
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
  const boostVehicleWash = useGameStore((s) => s.boostVehicleWash);

  const spec = VEHICLE_SPECS[initial.category];
  const { length, width, wheelRadius, wheelbase, trackWidth } = spec.dimensions;
  const halfTrack = trackWidth / 2;
  const halfBase = wheelbase / 2;

  const shape = useMemo(() => {
    switch (initial.category) {
      case 'budget':
        return {
          bodyH: 0.54,
          bodyY: wheelRadius + 0.24,
          cabinLen: length * 0.52,
          cabinH: 0.54,
          cabinW: width * 0.84,
          cabinZ: -0.18,
          hasSpoiler: false,
          hasRoofRails: false,
          hasSpareTire: false,
          hasStripe: false,
          hasSunroof: false,
          chromeTrim: false,
        };
      case 'hatchback':
        return {
          bodyH: 0.54,
          bodyY: wheelRadius + 0.24,
          cabinLen: length * 0.56,
          cabinH: 0.52,
          cabinW: width * 0.85,
          cabinZ: -0.22,
          hasSpoiler: true,
          hasRoofRails: false,
          hasSpareTire: false,
          hasStripe: false,
          hasSunroof: true,
          chromeTrim: false,
        };
      case 'sedan':
        return {
          bodyH: 0.52,
          bodyY: wheelRadius + 0.23,
          cabinLen: length * 0.46,
          cabinH: 0.48,
          cabinW: width * 0.84,
          cabinZ: -0.1,
          hasSpoiler: false,
          hasRoofRails: false,
          hasSpareTire: false,
          hasStripe: false,
          hasSunroof: true,
          chromeTrim: true,
        };
      case 'suv':
        return {
          bodyH: 0.7,
          bodyY: wheelRadius + 0.34,
          cabinLen: length * 0.62,
          cabinH: 0.66,
          cabinW: width * 0.88,
          cabinZ: -0.24,
          hasSpoiler: false,
          hasRoofRails: true,
          hasSpareTire: true,
          hasStripe: false,
          hasSunroof: true,
          chromeTrim: false,
        };
      case 'sports':
        return {
          bodyH: 0.42,
          bodyY: wheelRadius + 0.16,
          cabinLen: length * 0.42,
          cabinH: 0.38,
          cabinW: width * 0.8,
          cabinZ: -0.18,
          hasSpoiler: true,
          hasRoofRails: false,
          hasSpareTire: false,
          hasStripe: true,
          hasSunroof: false,
          chromeTrim: false,
        };
      case 'premium':
        return {
          bodyH: 0.56,
          bodyY: wheelRadius + 0.25,
          cabinLen: length * 0.5,
          cabinH: 0.48,
          cabinW: width * 0.85,
          cabinZ: -0.12,
          hasSpoiler: false,
          hasRoofRails: false,
          hasSpareTire: false,
          hasStripe: false,
          hasSunroof: true,
          chromeTrim: true,
        };
    }
  }, [initial.category, length, width, wheelRadius]);

  const dirtPatches = useMemo(() => {
    const patches: Array<{ pos: [number, number, number]; scale: [number, number, number] }> = [
      { pos: [-width * 0.506, shape.bodyY - 0.09, 0.4], scale: [0.04, 0.32, length * 0.44] },
      { pos: [-width * 0.506, shape.bodyY - 0.11, -0.58], scale: [0.04, 0.28, length * 0.36] },
      { pos: [width * 0.506, shape.bodyY - 0.09, 0.4], scale: [0.04, 0.32, length * 0.44] },
      { pos: [width * 0.506, shape.bodyY - 0.11, -0.58], scale: [0.04, 0.28, length * 0.36] },
      { pos: [0.16, shape.bodyY + shape.bodyH * 0.51, length * 0.26], scale: [width * 0.58, 0.04, length * 0.28] },
      { pos: [-0.22, shape.bodyY + shape.bodyH * 0.51, length * 0.14], scale: [width * 0.38, 0.035, length * 0.22] },
      { pos: [0, shape.bodyY - 0.05, -length * 0.508], scale: [width * 0.82, 0.28, 0.04] },
      { pos: [-0.1, shape.bodyY + shape.bodyH * 0.5 + shape.cabinH + 0.02, shape.cabinZ], scale: [shape.cabinW * 0.65, 0.04, shape.cabinLen * 0.58] },
    ];
    return patches;
  }, [width, length, shape]);

  const foamBlobs = useMemo(() => {
    const roofY = shape.bodyY + shape.bodyH * 0.5 + shape.cabinH + 0.06;
    const hoodY = shape.bodyY + shape.bodyH * 0.5 + 0.07;
    const blobs: Array<{ pos: [number, number, number]; r: number }> = [
      { pos: [0, roofY, shape.cabinZ], r: 0.48 },
      { pos: [-0.42, roofY - 0.04, shape.cabinZ + 0.35], r: 0.38 },
      { pos: [0.42, roofY - 0.04, shape.cabinZ - 0.35], r: 0.4 },
      { pos: [0, hoodY, length * 0.28], r: 0.46 },
      { pos: [-0.46, hoodY - 0.05, length * 0.22], r: 0.34 },
      { pos: [0.46, hoodY - 0.05, length * 0.22], r: 0.34 },
      { pos: [-width * 0.48, shape.bodyY + 0.08, 0.2], r: 0.34 },
      { pos: [width * 0.48, shape.bodyY + 0.08, -0.2], r: 0.34 },
      { pos: [0, hoodY, -length * 0.34], r: 0.38 },
    ];
    return blobs;
  }, [length, width, shape]);

  useFrame((clockState) => {
    const car = gameSimulation.vehicles.find((v) => v.id === vehicleId);
    if (!car || !rootRef.current) return;

    const t = clockState.clock.elapsedTime;
    rootRef.current.position.set(car.x, car.y, car.z);
    rootRef.current.rotation.y = car.rotationY;

    if (bodyBounceRef.current) {
      const bounce =
        car.speed > 0.3
          ? Math.sin(t * 16 + car.appearance.dirtSeed) * 0.018
          : Math.sin(t * 9 + car.appearance.dirtSeed) * 0.005;
      bodyBounceRef.current.position.y = bounce;
      bodyBounceRef.current.rotation.x = car.braking && car.speed > 0.4 ? 0.024 : 0;
    }

    if (flSteerRef.current) flSteerRef.current.rotation.y = car.steerAngle;
    if (frSteerRef.current) frSteerRef.current.rotation.y = car.steerAngle;
    for (let i = 0; i < 4; i++) {
      const w = wheelRefs.current[i];
      if (w) w.rotation.x = car.wheelSpin;
    }

    // Ultra-satisfying paint transformation: matte dusty mud -> showroom mirror gloss!
    const cleanFactor = 1 - car.dirtLevel;
    const applyGloss = (mat: THREE.MeshStandardMaterial | null) => {
      if (!mat) return;
      mat.roughness = THREE.MathUtils.lerp(0.86, 0.08, cleanFactor);
      mat.metalness = THREE.MathUtils.lerp(0.06, initial.isVip ? 0.64 : 0.48, cleanFactor);
      mat.envMapIntensity = THREE.MathUtils.lerp(0.4, 1.7, cleanFactor);
    };
    applyGloss(bodyMatRef.current);
    applyGloss(roofMatRef.current);

    if (dirtGroupRef.current) {
      dirtGroupRef.current.visible = car.dirtLevel > 0.02;
      sharedMats.dirt.opacity = Math.min(0.88, car.dirtLevel * 0.92);
    }

    if (foamGroupRef.current) {
      foamGroupRef.current.visible = car.foamLevel > 0.03;
      const s = 0.35 + car.foamLevel * 0.74;
      foamGroupRef.current.scale.set(1, s, 1);
      sharedMats.foam.opacity = Math.min(0.92, car.foamLevel * 0.95);
    }

    if (vipRingRef.current) {
      vipRingRef.current.rotation.z = t * 1.4;
    }
    if (vipStarRef.current) {
      vipStarRef.current.rotation.y = t * 2.2;
      vipStarRef.current.position.y =
        shape.bodyY + shape.bodyH * 0.5 + shape.cabinH + 0.65 + Math.sin(t * 3.5) * 0.1;
    }

    const timeMode = useGameStore.getState().settings.timeMode;
    const effTime = resolveEffectiveTime(gameSimulation.liveTimeOfDay, timeMode);
    const night = getNightFactor(effTime);
    sharedMats.headlight.emissiveIntensity = 0.65 + night * 2.8;
    sharedMats.drl.emissiveIntensity = 1.1 + night * 1.4;
    sharedMats.taillight.emissiveIntensity = car.braking ? 2.8 : 0.8 + night * 1.0;
  });

  const cabinY = shape.bodyY + shape.bodyH * 0.5 + shape.cabinH * 0.46;
  const frontWindshieldZ = shape.cabinZ + shape.cabinLen * 0.52;
  const rearWindshieldZ = shape.cabinZ - shape.cabinLen * 0.52;

  return (
    <group
      ref={rootRef}
      position={[initial.x, initial.y, initial.z]}
      rotation={[0, initial.rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        const car = gameSimulation.vehicles.find((v) => v.id === vehicleId);
        // Instant 1-tap Turbo-Boost on any washing player car + select it!
        if (car && car.owner === 'player' && car.state === 'washing') {
          boostVehicleWash(vehicleId);
        }
        setSelection({ type: 'vehicle', id: vehicleId });
      }}
    >
      {/* Ground Selection Ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.13, 0]}>
          <ringGeometry args={[length * 0.52, length * 0.58, 32]} />
          <meshBasicMaterial color="#00D4FF" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Golden VIP Halo Ring & Rotating Floating Crown Gem */}
      {initial.isVip && (
        <group>
          <mesh ref={vipRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.125, 0]}>
            <ringGeometry args={[length * 0.54, length * 0.61, 24]} />
            <meshBasicMaterial color="#FACC15" transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={vipStarRef} position={[0, shape.bodyY + shape.bodyH + shape.cabinH + 0.55, shape.cabinZ]}>
            <octahedronGeometry args={[0.26, 0]} />
            <meshStandardMaterial
              color="#FEF08A"
              emissive="#FACC15"
              emissiveIntensity={2.0}
              roughness={0.15}
              metalness={0.6}
            />
          </mesh>
        </group>
      )}

      {/* Animated Chassis Group */}
      <group ref={bodyBounceRef}>
        {/* Main Lower Body */}
        <mesh position={[0, shape.bodyY, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, shape.bodyH, length]} />
          <meshStandardMaterial
            ref={bodyMatRef}
            color={initial.appearance.primaryColor}
            roughness={0.78}
            metalness={0.14}
          />
        </mesh>

        {/* Sculpted Hood Nose Slope */}
        <mesh position={[0, shape.bodyY + shape.bodyH * 0.24, length * 0.36]} rotation={[0.14, 0, 0]} castShadow>
          <boxGeometry args={[width * 0.94, shape.bodyH * 0.42, length * 0.32]} />
          <meshStandardMaterial
            color={initial.appearance.primaryColor}
            roughness={0.22}
            metalness={0.38}
            envMapIntensity={1.4}
          />
        </mesh>

        {/* Sculpted Fender Wheel Arches (4 Corners) */}
        {[
          [-width * 0.49, wheelRadius + 0.12, halfBase],
          [width * 0.49, wheelRadius + 0.12, halfBase],
          [-width * 0.49, wheelRadius + 0.12, -halfBase],
          [width * 0.49, wheelRadius + 0.12, -halfBase],
        ].map(([fx, fy, fz], idx) => (
          <mesh key={idx} position={[fx, fy, fz]}>
            <boxGeometry args={[0.1, 0.24, wheelRadius * 2.15]} />
            <meshStandardMaterial color={initial.appearance.accentColor} roughness={0.5} />
          </mesh>
        ))}

        {/* Lower Front & Rear Bumpers + Side Skirts */}
        <mesh position={[0, shape.bodyY - shape.bodyH * 0.36, length * 0.495]} castShadow>
          <boxGeometry args={[width * 0.99, 0.21, 0.16]} />
          <meshStandardMaterial color={initial.appearance.accentColor} roughness={0.48} metalness={0.25} />
        </mesh>
        <mesh position={[0, shape.bodyY - shape.bodyH * 0.36, -length * 0.495]} castShadow>
          <boxGeometry args={[width * 0.99, 0.21, 0.16]} />
          <meshStandardMaterial color={initial.appearance.accentColor} roughness={0.48} metalness={0.25} />
        </mesh>

        {/* Dual Chrome Exhaust Tips */}
        {[-width * 0.28, width * 0.28].map((ex) => (
          <mesh key={ex} position={[ex, shape.bodyY - shape.bodyH * 0.4, -length * 0.53]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.16, 8]} />
            <meshStandardMaterial color="#E2E8F0" metalness={0.92} roughness={0.18} />
          </mesh>
        ))}

        {/* Russian-Style White License Plates (Front & Rear) */}
        <mesh position={[0, shape.bodyY - shape.bodyH * 0.26, length * 0.578]}>
          <planeGeometry args={[0.48, 0.12]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.4} />
        </mesh>
        <mesh position={[0, shape.bodyY - shape.bodyH * 0.24, -length * 0.578]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.48, 0.12]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.4} />
        </mesh>

        {/* Front Grille + Chrome/Gold Surround */}
        <mesh position={[0, shape.bodyY - 0.03, length * 0.506]}>
          <boxGeometry args={[width * 0.54, shape.bodyH * 0.42, 0.05]} />
          <meshStandardMaterial
            color={initial.isVip ? '#FACC15' : shape.chromeTrim ? '#DCE3EE' : '#161A24'}
            metalness={shape.chromeTrim || initial.isVip ? 0.88 : 0.35}
            roughness={0.22}
          />
        </mesh>

        {/* Cabin Roof Core */}
        <mesh position={[0, cabinY, shape.cabinZ]} castShadow receiveShadow>
          <boxGeometry args={[shape.cabinW, shape.cabinH, shape.cabinLen]} />
          <meshStandardMaterial
            ref={roofMatRef}
            color={initial.appearance.primaryColor}
            roughness={0.35}
            metalness={0.3}
          />
        </mesh>

        {/* Panoramic Tinted Sunroof */}
        {shape.hasSunroof && (
          <mesh position={[0, cabinY + shape.cabinH * 0.505, shape.cabinZ]} rotation={[-Math.PI / 2, 0, 0]} material={sharedMats.glass}>
            <planeGeometry args={[shape.cabinW * 0.72, shape.cabinLen * 0.58]} />
          </mesh>
        )}

        {/* Angled Sloped Front Windshield (gives sleek modern automotive silhouette!) */}
        <mesh
          position={[0, cabinY - 0.01, frontWindshieldZ + 0.08]}
          rotation={[-0.38, 0, 0]}
          material={sharedMats.glass}
        >
          <boxGeometry args={[shape.cabinW * 0.9, shape.cabinH * 0.95, 0.06]} />
        </mesh>

        {/* Angled Rear Fastback Window */}
        <mesh
          position={[0, cabinY - 0.01, rearWindshieldZ - 0.08]}
          rotation={[0.36, 0, 0]}
          material={sharedMats.glass}
        >
          <boxGeometry args={[shape.cabinW * 0.88, shape.cabinH * 0.9, 0.06]} />
        </mesh>

        {/* Side Glossy Windows */}
        <mesh
          position={[-shape.cabinW * 0.506, cabinY + 0.03, shape.cabinZ]}
          rotation={[0, -Math.PI / 2, 0]}
          material={sharedMats.glass}
        >
          <planeGeometry args={[shape.cabinLen * 0.84, shape.cabinH * 0.68]} />
        </mesh>
        <mesh
          position={[shape.cabinW * 0.506, cabinY + 0.03, shape.cabinZ]}
          rotation={[0, Math.PI / 2, 0]}
          material={sharedMats.glass}
        >
          <planeGeometry args={[shape.cabinLen * 0.84, shape.cabinH * 0.68]} />
        </mesh>

        {/* Side Mirrors */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[
              side * (width * 0.53),
              shape.bodyY + shape.bodyH * 0.52,
              shape.cabinZ + shape.cabinLen * 0.35,
            ]}
          >
            <boxGeometry args={[0.17, 0.1, 0.14]} />
            <meshStandardMaterial color={initial.appearance.accentColor} roughness={0.35} />
          </mesh>
        ))}

        {/* Sports Racing Stripe */}
        {shape.hasStripe && (
          <mesh position={[0, shape.bodyY + shape.bodyH * 0.508, length * 0.16]}>
            <boxGeometry args={[0.34, 0.02, length * 0.64]} />
            <meshStandardMaterial color={initial.appearance.accentColor} roughness={0.25} />
          </mesh>
        )}

        {/* Sports / Hatchback Rear Wing Spoiler */}
        {shape.hasSpoiler && (
          <group position={[0, shape.bodyY + shape.bodyH * 0.5 + 0.21, -length * 0.44]}>
            <mesh position={[-width * 0.32, -0.08, 0]}>
              <boxGeometry args={[0.08, 0.22, 0.16]} />
              <meshStandardMaterial color={initial.appearance.accentColor} />
            </mesh>
            <mesh position={[width * 0.32, -0.08, 0]}>
              <boxGeometry args={[0.08, 0.22, 0.16]} />
              <meshStandardMaterial color={initial.appearance.accentColor} />
            </mesh>
            <mesh castShadow>
              <boxGeometry args={[width * 0.94, 0.08, 0.28]} />
              <meshStandardMaterial color={initial.appearance.accentColor} roughness={0.25} metalness={0.35} />
            </mesh>
          </group>
        )}

        {/* SUV Roof Rails & Rear Mounted Spare Tire */}
        {shape.hasRoofRails && (
          <group>
            {[-shape.cabinW * 0.42, shape.cabinW * 0.42].map((rx) => (
              <mesh key={rx} position={[rx, cabinY + shape.cabinH * 0.5 + 0.08, shape.cabinZ]}>
                <boxGeometry args={[0.08, 0.09, shape.cabinLen * 0.84]} />
                <meshStandardMaterial color="#1E2430" metalness={0.65} roughness={0.35} />
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
            <cylinderGeometry args={[0.38, 0.38, 0.24, 14]} />
            <meshStandardMaterial color="#181C24" roughness={0.85} />
          </mesh>
        )}

        {/* Headlights + Modern LED DRL Strip & Rear Full-Width Tail Light Bar */}
        {[-width * 0.35, width * 0.35].map((lx) => (
          <group key={lx}>
            <mesh position={[lx, shape.bodyY + 0.05, length * 0.506]} material={sharedMats.headlight}>
              <boxGeometry args={[0.36, 0.15, 0.05]} />
            </mesh>
            <mesh position={[lx, shape.bodyY + 0.14, length * 0.508]} material={sharedMats.drl}>
              <boxGeometry args={[0.38, 0.035, 0.04]} />
            </mesh>
            <mesh position={[lx, shape.bodyY + 0.06, -length * 0.506]} material={sharedMats.taillight}>
              <boxGeometry args={[0.38, 0.14, 0.05]} />
            </mesh>
          </group>
        ))}
        {/* Sleek Connecting Rear LED Light Bar on Sports / Premium */}
        {(initial.category === 'sports' || initial.category === 'premium') && (
          <mesh position={[0, shape.bodyY + 0.06, -length * 0.508]} material={sharedMats.taillight}>
            <boxGeometry args={[width * 0.72, 0.05, 0.04]} />
          </mesh>
        )}

        {/* Dynamic Dirt & Mud Splatter Layer */}
        <group ref={dirtGroupRef}>
          {dirtPatches.map((p, idx) => (
            <mesh key={idx} position={p.pos} material={sharedMats.dirt}>
              <boxGeometry args={p.scale} />
            </mesh>
          ))}
        </group>

        {/* Dynamic Snow Foam Layer */}
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
        { pos: [-halfTrack, wheelRadius, halfBase] as [number, number, number], steerRef: flSteerRef, idx: 0 },
        { pos: [halfTrack, wheelRadius, halfBase] as [number, number, number], steerRef: frSteerRef, idx: 1 },
        { pos: [-halfTrack, wheelRadius, -halfBase] as [number, number, number], steerRef: null, idx: 2 },
        { pos: [halfTrack, wheelRadius, -halfBase] as [number, number, number], steerRef: null, idx: 3 },
      ].map((w) => (
        <group key={w.idx} position={w.pos} ref={w.steerRef ?? undefined}>
          <group
            ref={(el) => {
              wheelRefs.current[w.idx] = el;
            }}
          >
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[wheelRadius, wheelRadius, 0.27, 16]} />
              <meshStandardMaterial color="#141720" roughness={0.86} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[wheelRadius * 0.66, wheelRadius * 0.66, 0.29, 10]} />
              <meshStandardMaterial
                color={initial.appearance.rimColor}
                metalness={0.85}
                roughness={0.2}
              />
            </mesh>
            {/* Rim Cross Spokes */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.3, wheelRadius * 1.18, 0.06]} />
              <meshStandardMaterial color="#1E2430" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
