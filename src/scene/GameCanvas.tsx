import { Canvas, useFrame } from '@react-three/fiber';
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import * as THREE from 'three';
import { gameSimulation } from '../engine/simulation';
import { useGameStore } from '../store/useGameStore';
import { CameraRig } from './CameraRig';
import { LightingAndSky } from './LightingAndSky';
import { WorkersLayer } from './characters/WorkersLayer';
import { FloatingPopups } from './effects/FloatingPopups';
import { WashEffects } from './effects/WashEffects';
import { WashProgressBars } from './effects/WashProgressBars';
import { VehiclesLayer } from './vehicles/VehiclesLayer';
import { AmbientTraffic } from './world/AmbientTraffic';
import { CompetitorCarWash } from './world/CompetitorCarWash';
import { PlayerCarWash } from './world/PlayerCarWash';
import { StreetAndCity } from './world/StreetAndCity';

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AUTOMOIKA 3D Render Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
            background: '#0d111c',
            color: '#f8fafc',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-display)' }}>Ошибка 3D-рендера (WebGL)</h2>
          <p style={{ color: '#94a3b8', maxWidth: 420, fontSize: 14 }}>
            Не удалось инициализировать WebGL-контекст: {this.state.message}
          </p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function SimulationDriver() {
  const bindSimulation = useGameStore((s) => s._bindSimulation);

  useEffect(() => {
    bindSimulation();
  }, [bindSimulation]);

  useFrame((_, rawDt) => {
    const state = useGameStore.getState();
    const speed = state.paused ? 0 : state.simSpeed;
    gameSimulation.step(rawDt, speed);
  });

  return null;
}

export function GameCanvas() {
  const quality = useGameStore((s) => s.settings.quality);
  const setSelection = useGameStore((s) => s.setSelection);
  const [isPortraitMobile, setIsPortraitMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const onResize = () => setIsPortraitMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Native Retina DPR for razor-sharp edges & zero blurriness (up to 2.5x on Ultra!)
  const maxNativeDpr =
    typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 2, 2.5) : 2;
  const dpr: [number, number] =
    quality === 'ultra'
      ? [Math.min(1.75, maxNativeDpr), maxNativeDpr]
      : quality === 'high'
        ? isPortraitMobile
          ? [1.35, Math.min(2, maxNativeDpr)]
          : [1.5, Math.min(2.25, maxNativeDpr)]
        : quality === 'medium'
          ? [1.1, 1.5]
          : [1, 1.15];

  return (
    <WebGLErrorBoundary>
      <div className="canvas-viewport">
        <Canvas
          shadows={quality !== 'low'}
          dpr={dpr}
          camera={{
            position: isPortraitMobile ? [24, 24, 34] : [25, 21, 29],
            fov: isPortraitMobile ? 50 : 42,
            near: 0.5,
            far: 260,
          }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.AgXToneMapping,
            toneMappingExposure: 1.18,
          }}
          onPointerMissed={() => setSelection(null)}
        >
          <SimulationDriver />
          <LightingAndSky />
          <CameraRig />

          {/* World & Architecture */}
          <StreetAndCity />
          <PlayerCarWash />
          <CompetitorCarWash />
          <AmbientTraffic />

          {/* Dynamic Entities & Pure WebGL Effects */}
          <VehiclesLayer />
          <WorkersLayer />
          <WashEffects />
          <WashProgressBars />
          <FloatingPopups />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
