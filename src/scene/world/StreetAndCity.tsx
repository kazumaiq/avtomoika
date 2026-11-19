import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  getBuildingFacadeTexture,
  getRoadTexture,
} from '../../graphics/proceduralTextures';
import { useGameStore } from '../../store/useGameStore';
import { getNightFactor, resolveEffectiveTime } from '../LightingAndSky';

interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  wall: string;
  roof: string;
  windowGlow: string;
  seed: number;
  hasWaterTower?: boolean;
  hasRoofSign?: boolean;
  signColor?: string;
}

const SURROUNDING_BUILDINGS: BuildingSpec[] = [
  // West block (behind player & competitor)
  { x: -34, z: 18, w: 12, h: 14, d: 16, wall: '#A84B45', roof: '#242938', windowGlow: '#FFD97D', seed: 1, hasWaterTower: true },
  { x: -35, z: -17, w: 13, h: 18, d: 15, wall: '#375B78', roof: '#1E2433', windowGlow: '#7CE8FF', seed: 2, hasRoofSign: true, signColor: '#FF3B5C' },
  { x: -48, z: 22, w: 12, h: 22, d: 16, wall: '#4B4E6D', roof: '#191D2A', windowGlow: '#FFCA6B', seed: 3 },
  { x: -49, z: -20, w: 14, h: 25, d: 16, wall: '#8F4D3F', roof: '#222634', windowGlow: '#FFE399', seed: 4 },

  // East block (corner diner, auto parts shop, lofts)
  { x: 34, z: 19, w: 12, h: 11, d: 15, wall: '#C86B43', roof: '#262B3A', windowGlow: '#FFE082', seed: 5, hasRoofSign: true, signColor: '#00D4FF' },
  { x: 35, z: -18, w: 13, h: 16, d: 16, wall: '#3F6373', roof: '#1C2230', windowGlow: '#A5F3FC', seed: 6, hasWaterTower: true },
  { x: 49, z: 20, w: 14, h: 24, d: 16, wall: '#465270', roof: '#181C28', windowGlow: '#FFD27A', seed: 7 },
  { x: 50, z: -19, w: 13, h: 20, d: 15, wall: '#9E4C58', roof: '#202432', windowGlow: '#FFE196', seed: 8 },

  // Far North skyline (behind Competitor)
  { x: -20, z: -43, w: 15, h: 26, d: 12, wall: '#324362', roof: '#171C2B', windowGlow: '#FFD882', seed: 9, hasWaterTower: true },
  { x: 0, z: -45, w: 18, h: 32, d: 13, wall: '#4A3B5C', roof: '#181A28', windowGlow: '#7EE8FF', seed: 10, hasRoofSign: true, signColor: '#FFB800' },
  { x: 20, z: -43, w: 14, h: 22, d: 12, wall: '#9A5147', roof: '#1F2330', windowGlow: '#FFD57D', seed: 11 },

  // Far South skyline (behind Player)
  { x: -22, z: 45, w: 14, h: 19, d: 12, wall: '#3C536E', roof: '#1A202E', windowGlow: '#FFE08A', seed: 12 },
  { x: 2, z: 46, w: 17, h: 24, d: 12, wall: '#8C4D46', roof: '#1F2430', windowGlow: '#8CEEFF', seed: 13 },
  { x: 24, z: 45, w: 15, h: 21, d: 12, wall: '#464C6B', roof: '#1B1F2E', windowGlow: '#FFD97E', seed: 14 },
];

const LAMP_POSITIONS: Array<[number, number, number]> = [
  [-24, 6.2, 0],
  [-8, 6.2, 0],
  [8, 6.2, 0],
  [24, 6.2, 0],
  [-24, -6.2, Math.PI],
  [-8, -6.2, Math.PI],
  [8, -6.2, Math.PI],
  [24, -6.2, Math.PI],
];

const TREE_POSITIONS: Array<[number, number, number]> = [
  [-26, 10, 1.15],
  [-26, 26, 1.0],
  [25, 10, 1.1],
  [25, 27, 0.95],
  [-25, -10, 1.05],
  [-25, -26, 1.2],
  [25, -10, 1.0],
  [25, -26, 1.1],
  [-13, 35, 1.25],
  [12, 35, 1.15],
  [-13, -34, 1.1],
  [13, -34, 1.2],
  [-36, 7.2, 0.9],
  [36, 7.2, 0.95],
  [-36, -7.2, 0.92],
  [36, -7.2, 1.0],
];

const PEDESTRIANS = [
  { startX: -32, z: 6.3, dir: 1, speed: 1.55, shirt: '#38BDF8', pants: '#1E293B', skin: '#F2C9A8' },
  { startX: 28, z: 6.1, dir: -1, speed: 1.35, shirt: '#F43F5E', pants: '#1F2937', skin: '#E0AC82' },
  { startX: -12, z: -6.2, dir: 1, speed: 1.45, shirt: '#FACC15', pants: '#1E293B', skin: '#F5D5BC' },
  { startX: 16, z: -6.4, dir: -1, speed: 1.6, shirt: '#22C55E', pants: '#0F172A', skin: '#C6865B' },
  { startX: 4, z: 6.4, dir: 1, speed: 1.25, shirt: '#A855F7', pants: '#1E293B', skin: '#F2C9A8' },
];

export function StreetAndCity() {
  const roadTexture = useMemo(() => getRoadTexture(), []);

  const trunkInstRef = useRef<THREE.InstancedMesh>(null);
  const foliageInstRef = useRef<THREE.InstancedMesh>(null);
  const lampPoleInstRef = useRef<THREE.InstancedMesh>(null);
  const lampBulbInstRef = useRef<THREE.InstancedMesh>(null);
  const lampBulbMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lampPoolMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#FFE29A',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    []
  );
  const pedRefs = useRef<Array<THREE.Group | null>>([]);
  const pedPosRef = useRef<number[]>(PEDESTRIANS.map((p) => p.startX));

  useEffect(() => {
    return () => {
      lampPoolMat.dispose();
    };
  }, [lampPoolMat]);

  // Populate instanced meshes once for optimal draw-call count
  useEffect(() => {
    const dummy = new THREE.Object3D();

    if (trunkInstRef.current && foliageInstRef.current) {
      const foliageColors = ['#2E8B57', '#3FA66C', '#E07A38', '#2B7A63', '#D45E34'];
      const c = new THREE.Color();

      TREE_POSITIONS.forEach(([x, z, s], i) => {
        dummy.position.set(x, 1.15 * s, z);
        dummy.rotation.set(0, i * 0.7, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        trunkInstRef.current!.setMatrixAt(i, dummy.matrix);

        dummy.position.set(x, 2.85 * s, z);
        dummy.rotation.set(0.15, i * 1.1, 0.1);
        dummy.scale.set(1.25 * s, 1.35 * s, 1.25 * s);
        dummy.updateMatrix();
        foliageInstRef.current!.setMatrixAt(i, dummy.matrix);

        c.set(foliageColors[i % foliageColors.length]);
        foliageInstRef.current!.setColorAt(i, c);
      });
      trunkInstRef.current.instanceMatrix.needsUpdate = true;
      foliageInstRef.current.instanceMatrix.needsUpdate = true;
      if (foliageInstRef.current.instanceColor) {
        foliageInstRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (lampPoleInstRef.current && lampBulbInstRef.current) {
      LAMP_POSITIONS.forEach(([x, z, rotY], i) => {
        dummy.position.set(x, 2.9, z);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        lampPoleInstRef.current!.setMatrixAt(i, dummy.matrix);

        const armDir = z > 0 ? -0.9 : 0.9;
        dummy.position.set(x, 5.65, z + armDir);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        lampBulbInstRef.current!.setMatrixAt(i, dummy.matrix);
      });
      lampPoleInstRef.current.instanceMatrix.needsUpdate = true;
      lampBulbInstRef.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  // Dynamically boost streetlamp glow & animate strolling pedestrians
  useFrame((clockState, rawDt) => {
    const state = useGameStore.getState();
    const t = resolveEffectiveTime(state.timeOfDay, state.settings.timeMode);
    const night = getNightFactor(t);
    if (lampBulbMatRef.current) {
      lampBulbMatRef.current.emissiveIntensity = 0.5 + night * 3.0;
    }
    lampPoolMat.opacity = night * 0.24;

    const dt = state.paused ? 0 : Math.min(rawDt, 0.05) * state.simSpeed;
    const elapsed = clockState.clock.elapsedTime;
    PEDESTRIANS.forEach((ped, idx) => {
      if (dt > 0) {
        let nx = pedPosRef.current[idx] + ped.dir * ped.speed * dt;
        if (nx > 44) nx = -44;
        if (nx < -44) nx = 44;
        pedPosRef.current[idx] = nx;
      }
      const grp = pedRefs.current[idx];
      if (grp) {
        grp.position.set(pedPosRef.current[idx], 0.14 + Math.abs(Math.sin(elapsed * 6 + idx)) * 0.05, ped.z);
        grp.rotation.y = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    });
  });

  return (
    <group>
      {/* City Ground Base Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#1F2430" roughness={0.95} />
      </mesh>

      {/* Main Urban Two-Lane Avenue */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[140, 10]} />
        <meshStandardMaterial map={roadTexture} roughness={0.86} metalness={0.05} />
      </mesh>

      {/* Crosswalks at West & East ends of the car wash block */}
      {[-24.5, 24.5].map((cx) => (
        <group key={cx} position={[cx, 0.025, 0]}>
          {[-3.4, -2.0, -0.6, 0.8, 2.2, 3.6].map((cz) => (
            <mesh key={cz} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
              <planeGeometry args={[2.6, 0.72]} />
              <meshStandardMaterial color="#E6ECF5" roughness={0.75} />
            </mesh>
          ))}
        </group>
      ))}

      {/* South Sidewalk (Player Side) with Curb Cutouts for Entry/Exit Driveways */}
      <mesh position={[0, 0.07, 6.25]} receiveShadow>
        <boxGeometry args={[140, 0.14, 2.5]} />
        <meshStandardMaterial color="#646D80" roughness={0.9} />
      </mesh>
      {/* North Sidewalk (Competitor Side) */}
      <mesh position={[0, 0.07, -6.25]} receiveShadow>
        <boxGeometry args={[140, 0.14, 2.5]} />
        <meshStandardMaterial color="#646D80" roughness={0.9} />
      </mesh>

      {/* Driveway Aprons flushing seamlessly over sidewalks */}
      {/* Player East Entry & West Exit */}
      <mesh position={[18.5, 0.085, 6.25]} receiveShadow>
        <boxGeometry args={[5.4, 0.14, 2.6]} />
        <meshStandardMaterial color="#303848" roughness={0.85} />
      </mesh>
      <mesh position={[-16.8, 0.085, 6.25]} receiveShadow>
        <boxGeometry args={[5.4, 0.14, 2.6]} />
        <meshStandardMaterial color="#303848" roughness={0.85} />
      </mesh>
      {/* Competitor West Entry & East Exit */}
      <mesh position={[-17.5, 0.085, -6.25]} receiveShadow>
        <boxGeometry args={[5.4, 0.14, 2.6]} />
        <meshStandardMaterial color="#303848" roughness={0.85} />
      </mesh>
      <mesh position={[16.5, 0.085, -6.25]} receiveShadow>
        <boxGeometry args={[5.4, 0.14, 2.6]} />
        <meshStandardMaterial color="#303848" roughness={0.85} />
      </mesh>

      {/* Fire Hydrants & Street Benches for urban richness */}
      {[-11.5, 11.5].map((hx) => (
        <group key={hx} position={[hx, 0.14, 5.45]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.17, 0.7, 8]} />
            <meshStandardMaterial color="#E63946" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.74, 0]}>
            <sphereGeometry args={[0.15, 8, 6]} />
            <meshStandardMaterial color="#C81E2E" roughness={0.45} />
          </mesh>
        </group>
      ))}

      {/* Instanced Stylized Geometric Trees */}
      <instancedMesh
        ref={trunkInstRef}
        args={[undefined, undefined, TREE_POSITIONS.length]}
        castShadow
      >
        <cylinderGeometry args={[0.18, 0.28, 2.3, 6]} />
        <meshStandardMaterial color="#4A3228" roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={foliageInstRef}
        args={[undefined, undefined, TREE_POSITIONS.length]}
        castShadow
      >
        <dodecahedronGeometry args={[1.25, 0]} />
        <meshStandardMaterial roughness={0.78} flatShading />
      </instancedMesh>

      {/* Instanced Streetlight Poles & Glowing Lamps */}
      <instancedMesh
        ref={lampPoleInstRef}
        args={[undefined, undefined, LAMP_POSITIONS.length]}
        castShadow
      >
        <cylinderGeometry args={[0.09, 0.13, 5.8, 7]} />
        <meshStandardMaterial color="#1F2633" metalness={0.6} roughness={0.4} />
      </instancedMesh>
      <instancedMesh
        ref={lampBulbInstRef}
        args={[undefined, undefined, LAMP_POSITIONS.length]}
      >
        <boxGeometry args={[0.42, 0.18, 0.75]} />
        <meshStandardMaterial
          ref={lampBulbMatRef}
          color="#FFF3C4"
          emissive="#FFB84D"
          emissiveIntensity={1.2}
          roughness={0.2}
        />
      </instancedMesh>

      {/* Warm Glowing Streetlamp Ground Light Pools (visible at dusk & night) */}
      <group>
        {LAMP_POSITIONS.map(([x, z], idx) => (
          <mesh
            key={idx}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[x, 0.03, z > 0 ? z - 2.2 : z + 2.2]}
            material={lampPoolMat}
          >
            <circleGeometry args={[4.4, 20]} />
          </mesh>
        ))}
      </group>

      {/* Strolling Sidewalk Pedestrians */}
      <group>
        {PEDESTRIANS.map((ped, idx) => (
          <group
            key={idx}
            ref={(el) => {
              pedRefs.current[idx] = el;
            }}
            position={[ped.startX, 0.14, ped.z]}
          >
            <mesh position={[0, 0.42, 0]} castShadow>
              <boxGeometry args={[0.26, 0.56, 0.18]} />
              <meshStandardMaterial color={ped.pants} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.92, 0]} castShadow>
              <boxGeometry args={[0.34, 0.48, 0.22]} />
              <meshStandardMaterial color={ped.shirt} roughness={0.68} />
            </mesh>
            <mesh position={[0, 1.32, 0]} castShadow>
              <sphereGeometry args={[0.16, 10, 8]} />
              <meshStandardMaterial color={ped.skin} roughness={0.68} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Surrounding Spider-Verse Stylized City Blocks */}
      {SURROUNDING_BUILDINGS.map((b, idx) => (
        <CityBuilding key={idx} spec={b} />
      ))}
    </group>
  );
}

function CityBuilding({ spec }: { spec: BuildingSpec }) {
  const facadeTex = useMemo(
    () => getBuildingFacadeTexture(spec.wall, spec.windowGlow, spec.seed),
    [spec.wall, spec.windowGlow, spec.seed]
  );

  return (
    <group position={[spec.x, 0, spec.z]}>
      {/* Main Building Volume */}
      <mesh position={[0, spec.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[spec.w, spec.h, spec.d]} />
        <meshStandardMaterial map={facadeTex} roughness={0.82} />
      </mesh>

      {/* Roof Parapet Rim */}
      <mesh position={[0, spec.h + 0.35, 0]}>
        <boxGeometry args={[spec.w + 0.5, 0.7, spec.d + 0.5]} />
        <meshStandardMaterial color={spec.roof} roughness={0.7} />
      </mesh>

      {/* Stylized Rooftop Water Tower (classic urban Spider-Verse silhouette!) */}
      {spec.hasWaterTower && (
        <group position={[spec.w * 0.24, spec.h + 0.7, -spec.d * 0.2]}>
          <mesh position={[-0.55, 0.9, -0.55]}>
            <boxGeometry args={[0.16, 1.8, 0.16]} />
            <meshStandardMaterial color="#1B202C" />
          </mesh>
          <mesh position={[0.55, 0.9, -0.55]}>
            <boxGeometry args={[0.16, 1.8, 0.16]} />
            <meshStandardMaterial color="#1B202C" />
          </mesh>
          <mesh position={[-0.55, 0.9, 0.55]}>
            <boxGeometry args={[0.16, 1.8, 0.16]} />
            <meshStandardMaterial color="#1B202C" />
          </mesh>
          <mesh position={[0.55, 0.9, 0.55]}>
            <boxGeometry args={[0.16, 1.8, 0.16]} />
            <meshStandardMaterial color="#1B202C" />
          </mesh>
          <mesh position={[0, 2.7, 0]}>
            <cylinderGeometry args={[1.05, 1.05, 2.1, 10]} />
            <meshStandardMaterial color="#7C4D3A" roughness={0.88} />
          </mesh>
          <mesh position={[0, 4.15, 0]}>
            <coneGeometry args={[1.18, 0.9, 10]} />
            <meshStandardMaterial color="#2A303E" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* Glowing Rooftop Neon Accent Box */}
      {spec.hasRoofSign && (
        <mesh position={[0, spec.h + 2.0, spec.z < 0 ? spec.d * 0.42 : -spec.d * 0.42]}>
          <boxGeometry args={[spec.w * 0.65, 2.2, 0.4]} />
          <meshStandardMaterial
            color={spec.signColor ?? '#00D4FF'}
            emissive={spec.signColor ?? '#00D4FF'}
            emissiveIntensity={0.85}
            roughness={0.3}
          />
        </mesh>
      )}
    </group>
  );
}
