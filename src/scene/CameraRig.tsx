import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { gameSimulation } from '../engine/simulation';
import { useGameStore } from '../store/useGameStore';
import type { CameraPreset } from '../types/game';

const PRESET_VIEWS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [24, 21, 29], target: [0, 0.8, 6.5] },
  player: { pos: [11, 12.5, 2.5], target: [-1.0, 1.0, 18.0] },
  competitor: { pos: [-11, 13.0, -2.0], target: [0.5, 1.0, -17.5] },
  street: { pos: [24, 7.5, 9.5], target: [-4, 1.6, -2.5] },
};

const TOUCH_CONFIG = {
  ONE: THREE.TOUCH.PAN,
  TWO: THREE.TOUCH.DOLLY_ROTATE,
};

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  const cameraPreset = useGameStore((s) => s.cameraPreset);
  const cameraPresetSeq = useGameStore((s) => s.cameraPresetSeq);
  const selection = useGameStore((s) => s.selection);
  const followSelected = useGameStore((s) => s.followSelected);

  const transitionRef = useRef<{
    active: boolean;
    desiredPos: THREE.Vector3;
    desiredTarget: THREE.Vector3;
  }>({
    active: false,
    desiredPos: new THREE.Vector3(24, 21, 29),
    desiredTarget: new THREE.Vector3(0, 0.8, 6.5),
  });

  const keysPressed = useRef<Set<string>>(new Set());
  const tmpVec = useRef(new THREE.Vector3());
  const tmpFollowPos = useRef(new THREE.Vector3());
  const fwdVec = useRef(new THREE.Vector3());
  const rightVec = useRef(new THREE.Vector3());

  // Trigger smooth camera glide when preset button is pressed
  useEffect(() => {
    const view = PRESET_VIEWS[cameraPreset];
    const isPortrait = typeof window !== 'undefined' && window.innerWidth < 768;
    const distScale = isPortrait && cameraPreset === 'overview' ? 1.15 : 1.0;
    transitionRef.current.active = true;
    transitionRef.current.desiredPos.set(
      view.pos[0] * distScale,
      view.pos[1] * distScale,
      view.pos[2] * distScale
    );
    transitionRef.current.desiredTarget.set(...view.target);
  }, [cameraPreset, cameraPresetSeq]);

  // Cancel preset transition if user starts manually panning/orbiting
  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const onStart = () => {
      transitionRef.current.active = false;
    };
    ctrl.addEventListener('start', onStart);
    return () => {
      ctrl.removeEventListener('start', onStart);
    };
  }, []);

  // Optional smooth WASD / Arrow camera pan for desktop comfort
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (
        e.code === 'KeyW' ||
        e.code === 'KeyA' ||
        e.code === 'KeyS' ||
        e.code === 'KeyD' ||
        e.code.startsWith('Arrow')
      ) {
        keysPressed.current.add(e.code);
        transitionRef.current.active = false;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useFrame((_, dt) => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const clampedDt = Math.min(dt, 0.05);

    // Desktop keyboard pan
    if (keysPressed.current.size > 0) {
      camera.getWorldDirection(fwdVec.current);
      fwdVec.current.y = 0;
      fwdVec.current.normalize();
      rightVec.current.crossVectors(fwdVec.current, camera.up).normalize();

      const panAmt = 22 * clampedDt;
      const dx =
        (keysPressed.current.has('KeyD') || keysPressed.current.has('ArrowRight') ? 1 : 0) -
        (keysPressed.current.has('KeyA') || keysPressed.current.has('ArrowLeft') ? 1 : 0);
      const dz =
        (keysPressed.current.has('KeyW') || keysPressed.current.has('ArrowUp') ? 1 : 0) -
        (keysPressed.current.has('KeyS') || keysPressed.current.has('ArrowDown') ? 1 : 0);

      if (dx !== 0 || dz !== 0) {
        tmpVec.current
          .set(0, 0, 0)
          .addScaledVector(rightVec.current, dx * panAmt)
          .addScaledVector(fwdVec.current, dz * panAmt);
        ctrl.target.add(tmpVec.current);
        camera.position.add(tmpVec.current);
      }
    }

    if (followSelected && selection) {
      let tx: number | null = null;
      let tz: number | null = null;

      if (selection.type === 'vehicle') {
        const car = gameSimulation.vehicles.find((v) => v.id === selection.id);
        if (car) {
          tx = car.x;
          tz = car.z;
        }
      } else if (selection.type === 'worker') {
        const rt = gameSimulation.workerRuntimes.get(selection.id);
        if (rt) {
          tx = rt.x;
          tz = rt.z;
        }
      }

      if (tx !== null && tz !== null) {
        tmpVec.current.set(tx, 1.2, tz);
        ctrl.target.lerp(tmpVec.current, clampedDt * 5);
        tmpFollowPos.current.set(tx + 11, 10, tz + 12);
        camera.position.lerp(tmpFollowPos.current, clampedDt * 3.2);
      }
    } else if (transitionRef.current.active) {
      const k = 1 - Math.exp(-clampedDt * 5.2);
      camera.position.lerp(transitionRef.current.desiredPos, k);
      ctrl.target.lerp(transitionRef.current.desiredTarget, k);
      if (
        camera.position.distanceTo(transitionRef.current.desiredPos) < 0.25 &&
        ctrl.target.distanceTo(transitionRef.current.desiredTarget) < 0.2
      ) {
        transitionRef.current.active = false;
      }
    }

    // Keep camera smoothly bounded over the playable city block
    ctrl.target.x = THREE.MathUtils.clamp(ctrl.target.x, -26, 26);
    ctrl.target.z = THREE.MathUtils.clamp(ctrl.target.z, -24, 28);
    ctrl.target.y = THREE.MathUtils.clamp(ctrl.target.y, 0, 5);

    ctrl.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      touches={TOUCH_CONFIG}
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.68}
      panSpeed={1.05}
      zoomSpeed={0.9}
      minDistance={10}
      maxDistance={62}
      minPolarAngle={0.28}
      maxPolarAngle={1.22}
      screenSpacePanning={false}
    />
  );
}
