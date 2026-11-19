import { Canvas, useFrame } from '@react-three/fiber';
import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
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

  const dpr: [number, number] =
    quality === 'high' ? [1, 2] : quality === 'medium' ? [1, 1.5] : [0.75, 1];

  return (
    <WebGLErrorBoundary>
      <div className="canvas-viewport">
        <Canvas
          shadows={quality !== 'low'}
          dpr={dpr}
          camera={{ position: [27, 23, 31], fov: 44, near: 0.5, far: 260 }}
          gl={{
            antialias: quality !== 'low',
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.16,
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

          {/* Dynamic Entities & Visual Effects */}
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
