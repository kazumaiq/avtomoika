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
  overview: { pos: [26, 22, 30], target: [0, 1.0, 2.5] },
  player: { pos: [12, 12.5, 2.0], target: [-2.0, 1.2, 17.5] },
  competitor: { pos: [-12, 13.5, -2.0], target: [0.5, 1.2, -17.5] },
  street: { pos: [24, 7.0, 9.5], target: [-5, 1.8, -3] },
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
    desiredPos: new THREE.Vector3(30, 27, 36),
    desiredTarget: new THREE.Vector3(0, 0.5, 4),
  });

  const tmpVec = useRef(new THREE.Vector3());
  const tmpFollowPos = useRef(new THREE.Vector3());

  // Trigger smooth camera glide when preset button is pressed
  useEffect(() => {
    const view = PRESET_VIEWS[cameraPreset];
    transitionRef.current.active = true;
    transitionRef.current.desiredPos.set(...view.pos);
    transitionRef.current.desiredTarget.set(...view.target);
  }, [cameraPreset, cameraPresetSeq]);

  // Cancel preset transition if user starts manually orbiting/panning
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

  useFrame((_, dt) => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const clampedDt = Math.min(dt, 0.05);

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
      const k = 1 - Math.exp(-clampedDt * 4.5);
      camera.position.lerp(transitionRef.current.desiredPos, k);
      ctrl.target.lerp(transitionRef.current.desiredTarget, k);
      if (
        camera.position.distanceTo(transitionRef.current.desiredPos) < 0.25 &&
        ctrl.target.distanceTo(transitionRef.current.desiredTarget) < 0.2
      ) {
        transitionRef.current.active = false;
      }
    }

    // Clamp target within playable city block bounds
    ctrl.target.x = THREE.MathUtils.clamp(ctrl.target.x, -30, 30);
    ctrl.target.z = THREE.MathUtils.clamp(ctrl.target.z, -28, 30);
    ctrl.target.y = THREE.MathUtils.clamp(ctrl.target.y, 0, 6);

    ctrl.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.72}
      panSpeed={0.85}
      zoomSpeed={0.95}
      minDistance={11}
      maxDistance={68}
      minPolarAngle={0.26}
      maxPolarAngle={1.24}
      screenSpacePanning={false}
    />
  );
}
