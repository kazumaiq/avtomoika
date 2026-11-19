import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import type { WorkerProfile } from '../../types/game';

interface WorkerCharacterProps {
  profile: WorkerProfile;
}

export function WorkerCharacter({ profile }: WorkerCharacterProps) {
  const rootRef = useRef<THREE.Group>(null);
  const hipsRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  const lanceToolRef = useRef<THREE.Group>(null);
  const foamToolRef = useRef<THREE.Group>(null);
  const spongeToolRef = useRef<THREE.Group>(null);
  const towelToolRef = useRef<THREE.Group>(null);

  const isSelected = useGameStore(
    (s) => s.selection?.type === 'worker' && s.selection.id === profile.id
  );
  const setSelection = useGameStore((s) => s.setSelection);

  const app = profile.appearance;

  useFrame(() => {
    const rt = gameSimulation.workerRuntimes.get(profile.id);
    if (!rt || !rootRef.current) return;

    rootRef.current.position.set(rt.x, rt.y, rt.z);
    rootRef.current.rotation.y = rt.rotationY;

    const p = rt.animPhase;
    const action = rt.action;

    // Toggle held equipment cleanly based on exact wash stage
    if (lanceToolRef.current) lanceToolRef.current.visible = action === 'rinsing';
    if (foamToolRef.current) foamToolRef.current.visible = action === 'foaming';
    if (spongeToolRef.current) spongeToolRef.current.visible = action === 'scrubbing';
    if (towelToolRef.current) towelToolRef.current.visible = action === 'drying';

    let hipY = 0.88;
    let torsoPitch = 0;
    let torsoYaw = 0;
    let headPitch = 0;
    let headYaw = 0;
    let lArmX = 0;
    let lArmZ = 0.08;
    let rArmX = 0;
    let rArmZ = -0.08;
    let lLegX = 0;
    let rLegX = 0;

    if (action === 'idle') {
      hipY = 0.88 + Math.sin(p * 0.45) * 0.015;
      torsoYaw = Math.sin(p * 0.25) * 0.06;
      headYaw = Math.sin(p * 0.32) * 0.22;
      lArmX = Math.sin(p * 0.45) * 0.05;
      rArmX = -Math.sin(p * 0.45) * 0.05;
    } else if (action === 'walking') {
      const stride = Math.sin(p * 1.45);
      hipY = 0.88 + Math.abs(Math.cos(p * 1.45)) * 0.07;
      torsoPitch = 0.08;
      torsoYaw = stride * 0.1;
      lLegX = stride * 0.65;
      rLegX = -stride * 0.65;
      lArmX = -stride * 0.55;
      rArmX = stride * 0.55;
    } else if (action === 'greeting') {
      hipY = 0.88 + Math.sin(p * 0.8) * 0.02;
      torsoPitch = 0.06;
      rArmX = -2.35 + Math.sin(p * 2.2) * 0.22;
      rArmZ = -0.45 + Math.sin(p * 2.2) * 0.28;
      lArmX = -0.55;
      headPitch = -0.05;
    } else if (action === 'rinsing') {
      // Athletic crouched high-pressure washer stance sweeping across panels!
      const sweep = Math.sin(p * 1.3);
      const crouch = Math.sin(p * 0.65) * 0.06;
      hipY = 0.81 + crouch;
      torsoPitch = 0.22;
      torsoYaw = sweep * 0.34;
      headYaw = sweep * 0.2;
      rArmX = -1.25 + Math.sin(p * 1.8) * 0.18;
      rArmZ = -0.18 + sweep * 0.2;
      lArmX = -1.05 + Math.sin(p * 1.8) * 0.14;
      lArmZ = 0.32;
      lLegX = 0.22;
      rLegX = -0.22;
    } else if (action === 'foaming') {
      // Wide sweeping snow-foam gun motion
      const sweep = Math.sin(p * 1.15);
      hipY = 0.84 + Math.sin(p * 1.15) * 0.03;
      torsoPitch = 0.16;
      torsoYaw = sweep * 0.42;
      rArmX = -1.35 + Math.cos(p * 1.5) * 0.24;
      rArmZ = -0.25 + sweep * 0.35;
      lArmX = -0.85;
      lArmZ = 0.25;
      lLegX = 0.16;
      rLegX = -0.16;
    } else if (action === 'scrubbing') {
      // Energetic leaning & circular hand-scrubbing motion!
      const scrub = Math.sin(p * 2.8);
      const scrubCos = Math.cos(p * 2.8);
      hipY = 0.78 + Math.abs(scrub) * 0.05;
      torsoPitch = 0.34 + scrub * 0.05;
      torsoYaw = scrubCos * 0.18;
      rArmX = -1.45 + scrub * 0.38;
      rArmZ = -0.18 + scrubCos * 0.32;
      lArmX = -1.15 - scrub * 0.24;
      lArmZ = 0.24;
      lLegX = 0.28;
      rLegX = -0.2;
    } else if (action === 'drying') {
      // Fast alternating microfiber towel wiping
      const wipe = Math.sin(p * 3.1);
      hipY = 0.85 + Math.abs(wipe) * 0.03;
      torsoPitch = 0.22;
      torsoYaw = wipe * 0.24;
      rArmX = -1.38 + wipe * 0.42;
      rArmZ = -0.22 + wipe * 0.28;
      lArmX = -1.2 - wipe * 0.35;
      lArmZ = 0.22 - wipe * 0.2;
    } else if (action === 'celebrating') {
      // Proud double fist-pump / cheer on wash completion!
      const jump = Math.abs(Math.sin(p * 2.2));
      hipY = 0.9 + jump * 0.16;
      rArmX = -2.65 + Math.sin(p * 2.6) * 0.25;
      lArmX = -2.55 - Math.sin(p * 2.6) * 0.25;
      rArmZ = -0.45;
      lArmZ = 0.45;
    }

    if (hipsRef.current) hipsRef.current.position.y = hipY;
    if (torsoRef.current) {
      torsoRef.current.rotation.x = torsoPitch;
      torsoRef.current.rotation.y = torsoYaw;
    }
    if (headRef.current) {
      headRef.current.rotation.x = headPitch;
      headRef.current.rotation.y = headYaw;
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = lArmX;
      leftArmRef.current.rotation.z = lArmZ;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = rArmX;
      rightArmRef.current.rotation.z = rArmZ;
    }
    if (leftLegRef.current) leftLegRef.current.rotation.x = lLegX;
    if (rightLegRef.current) rightLegRef.current.rotation.x = rLegX;
  });

  return (
    <group
      ref={rootRef}
      onClick={(e) => {
        e.stopPropagation();
        setSelection({ type: 'worker', id: profile.id });
      }}
    >
      {/* Selection Ring under worker */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
          <ringGeometry args={[0.55, 0.72, 20]} />
          <meshBasicMaterial color="#FFB800" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Pelvis / Hips Pivot */}
      <group ref={hipsRef} position={[0, 0.88, 0]}>
        {/* Waist Belt */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.42, 0.14, 0.26]} />
          <meshStandardMaterial color="#141821" roughness={0.6} />
        </mesh>

        {/* Left Leg */}
        <group ref={leftLegRef} position={[-0.12, -0.05, 0]}>
          <mesh position={[0, -0.34, 0]} castShadow>
            <boxGeometry args={[0.16, 0.62, 0.18]} />
            <meshStandardMaterial color={app.uniformColor} roughness={0.75} />
          </mesh>
          <mesh position={[0, -0.72, 0.04]} castShadow>
            <boxGeometry args={[0.17, 0.18, 0.26]} />
            <meshStandardMaterial color="#1B1F29" roughness={0.7} />
          </mesh>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.12, -0.05, 0]}>
          <mesh position={[0, -0.34, 0]} castShadow>
            <boxGeometry args={[0.16, 0.62, 0.18]} />
            <meshStandardMaterial color={app.uniformColor} roughness={0.75} />
          </mesh>
          <mesh position={[0, -0.72, 0.04]} castShadow>
            <boxGeometry args={[0.17, 0.18, 0.26]} />
            <meshStandardMaterial color="#1B1F29" roughness={0.7} />
          </mesh>
        </group>

        {/* Upper Torso + High-Vis Work Vest */}
        <group ref={torsoRef} position={[0, 0.08, 0]}>
          <mesh position={[0, 0.28, 0]} castShadow>
            <boxGeometry args={[0.48, 0.56, 0.28]} />
            <meshStandardMaterial color={app.uniformColor} roughness={0.7} />
          </mesh>
          {/* Stylish Graphic Work Vest */}
          <mesh position={[0, 0.28, 0]}>
            <boxGeometry args={[0.5, 0.44, 0.3]} />
            <meshStandardMaterial color={app.vestColor} roughness={0.55} />
          </mesh>
          {/* Reflective Chest Stripe */}
          <mesh position={[0, 0.24, 0.155]}>
            <boxGeometry args={[0.44, 0.06, 0.02]} />
            <meshStandardMaterial color="#F8FAFC" emissive="#E2E8F0" emissiveIntensity={0.25} />
          </mesh>

          {/* Head + Hair / Cap / Glasses */}
          <group ref={headRef} position={[0, 0.68, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.34, 0.34, 0.34]} />
              <meshStandardMaterial color={app.skinColor} roughness={0.68} />
            </mesh>
            {/* Eyes */}
            <mesh position={[-0.075, 0.03, 0.175]}>
              <boxGeometry args={[0.045, 0.045, 0.02]} />
              <meshStandardMaterial color="#11131C" />
            </mesh>
            <mesh position={[0.075, 0.03, 0.175]}>
              <boxGeometry args={[0.045, 0.045, 0.02]} />
              <meshStandardMaterial color="#11131C" />
            </mesh>

            {/* Optional Stylish Shades/Glasses */}
            {app.hasGlasses && (
              <mesh position={[0, 0.04, 0.185]}>
                <boxGeometry args={[0.3, 0.08, 0.03]} />
                <meshStandardMaterial color="#0F172A" metalness={0.6} roughness={0.2} />
              </mesh>
            )}

            {/* Hair / Cap / Beanie */}
            {app.hatStyle === 'cap' && (
              <group position={[0, 0.16, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.37, 0.12, 0.37]} />
                  <meshStandardMaterial color={app.hatColor} roughness={0.55} />
                </mesh>
                <mesh position={[0, -0.04, 0.22]}>
                  <boxGeometry args={[0.32, 0.04, 0.18]} />
                  <meshStandardMaterial color={app.hatColor} roughness={0.55} />
                </mesh>
              </group>
            )}
            {app.hatStyle === 'beanie' && (
              <mesh position={[0, 0.18, 0]} castShadow>
                <sphereGeometry args={[0.21, 8, 6]} />
                <meshStandardMaterial color={app.hatColor} roughness={0.8} />
              </mesh>
            )}
            {app.hatStyle === 'none' && (
              <mesh position={[0, 0.16, -0.02]} castShadow>
                <boxGeometry args={[0.36, 0.12, 0.36]} />
                <meshStandardMaterial color={app.hairColor} roughness={0.85} />
              </mesh>
            )}
          </group>

          {/* Left Arm */}
          <group ref={leftArmRef} position={[-0.31, 0.48, 0]}>
            <mesh position={[0, -0.24, 0]} castShadow>
              <boxGeometry args={[0.14, 0.5, 0.15]} />
              <meshStandardMaterial color={app.uniformColor} roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.52, 0]}>
              <boxGeometry args={[0.13, 0.13, 0.13]} />
              <meshStandardMaterial color={app.skinColor} roughness={0.68} />
            </mesh>
          </group>

          {/* Right Arm + Dynamic Wash Equipment Tools */}
          <group ref={rightArmRef} position={[0.31, 0.48, 0]}>
            <mesh position={[0, -0.24, 0]} castShadow>
              <boxGeometry args={[0.14, 0.5, 0.15]} />
              <meshStandardMaterial color={app.uniformColor} roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.52, 0]}>
              <boxGeometry args={[0.13, 0.13, 0.13]} />
              <meshStandardMaterial color={app.skinColor} roughness={0.68} />
            </mesh>

            {/* Tool 1: High-Pressure Water Lance */}
            <group ref={lanceToolRef} position={[0, -0.54, 0.12]} visible={false}>
              <mesh position={[0, 0, 0.12]}>
                <boxGeometry args={[0.09, 0.16, 0.22]} />
                <meshStandardMaterial color="#FFB800" roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.02, 0.62]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.028, 0.032, 0.88, 6]} />
                <meshStandardMaterial color="#CBD5E1" metalness={0.8} roughness={0.25} />
              </mesh>
              <mesh position={[0, 0.02, 1.08]}>
                <boxGeometry args={[0.07, 0.07, 0.09]} />
                <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={0.8} />
              </mesh>
            </group>

            {/* Tool 2: Snow Foam Cannon */}
            <group ref={foamToolRef} position={[0, -0.54, 0.14]} visible={false}>
              <mesh position={[0, 0, 0.18]}>
                <boxGeometry args={[0.11, 0.16, 0.34]} />
                <meshStandardMaterial color="#FF3B5C" roughness={0.4} />
              </mesh>
              {/* Foam Soap Bottle */}
              <mesh position={[0, -0.18, 0.3]}>
                <cylinderGeometry args={[0.09, 0.1, 0.24, 8]} />
                <meshStandardMaterial color="#F8FAFC" roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.02, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.06, 0.04, 0.24, 8]} />
                <meshStandardMaterial color="#1E293B" />
              </mesh>
            </group>

            {/* Tool 3: Wash Sponge / Mitt */}
            <group ref={spongeToolRef} position={[0, -0.55, 0.12]} visible={false}>
              <mesh>
                <boxGeometry args={[0.2, 0.12, 0.26]} />
                <meshStandardMaterial color="#FACC15" roughness={0.9} />
              </mesh>
            </group>

            {/* Tool 4: Microfiber Drying Towel */}
            <group ref={towelToolRef} position={[0, -0.56, 0.14]} visible={false}>
              <mesh>
                <boxGeometry args={[0.26, 0.06, 0.32]} />
                <meshStandardMaterial color="#38BDF8" roughness={0.85} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
