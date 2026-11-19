import { Html } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { COMPETITOR_LAYOUT, PLAYER_LAYOUT } from '../../config/worldLayout';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import type { WashStage } from '../../types/game';

interface ActiveBayInfo {
  id: string;
  x: number;
  z: number;
  progress: number;
  stage: WashStage;
  isPlayer: boolean;
  isVip: boolean;
}

const STAGE_SHORT: Record<WashStage, { text: string; color: string }> = {
  none: { text: '', color: '#94a3b8' },
  greeting: { text: 'ПРИЁМ', color: '#ffb800' },
  rinse: { text: 'СМЫВ', color: '#38bdf8' },
  foam: { text: 'ПЕНА', color: '#f8fafc' },
  scrub: { text: 'МОЙКА', color: '#00d4ff' },
  dry: { text: 'СУШКА', color: '#22c55e' },
  done: { text: 'ГОТОВО', color: '#a3e635' },
};

export function WashProgressBars() {
  const started = useGameStore((s) => s.started);
  const [activeCars, setActiveCars] = useState<ActiveBayInfo[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const list: ActiveBayInfo[] = [];
      for (const car of gameSimulation.vehicles) {
        if (car.state === 'washing' && car.bayIndex >= 0) {
          const layout = car.owner === 'player' ? PLAYER_LAYOUT : COMPETITOR_LAYOUT;
          const bayPos = layout.bayPositions[car.bayIndex];
          if (bayPos) {
            list.push({
              id: car.id,
              x: bayPos.x,
              z: bayPos.z,
              progress: car.washProgress,
              stage: car.washStage,
              isPlayer: car.owner === 'player',
              isVip: car.isVip,
            });
          }
        }
      }
      setActiveCars(list);
    }, 160);
    return () => window.clearInterval(id);
  }, []);

  return (
    <group>
      {activeCars.map((item) => {
        const meta = STAGE_SHORT[item.stage];
        const puddleScale = 0.55 + Math.min(1, item.progress * 1.4) * 0.55;
        return (
          <group key={item.id}>
            {/* Glossy Dynamic Wet Floor Puddle under active wash bay */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[item.x, 0.115, item.z]}
              scale={[puddleScale, puddleScale, 1]}
            >
              <circleGeometry args={[2.45, 24]} />
              <meshPhysicalMaterial
                color={item.stage === 'foam' || item.stage === 'scrub' ? '#DCF2FF' : '#38BDF8'}
                roughness={0.05}
                metalness={0.4}
                clearcoat={1.0}
                transparent
                opacity={0.38}
                depthWrite={false}
              />
            </mesh>

            {/* Compact Overhead Wash Stage Indicator (Strictly zIndexRange [1, 4] behind HUD & Panels!) */}
            {started && (
              <Html
                position={[item.x, 2.98, item.z]}
                center
                distanceFactor={26}
                zIndexRange={[1, 4]}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                <div
                  style={{
                    background: 'rgba(10, 15, 28, 0.88)',
                    border: `1.5px solid ${
                      item.isVip
                        ? '#FACC15'
                        : item.isPlayer
                          ? 'rgba(0,212,255,0.55)'
                          : 'rgba(255,77,79,0.5)'
                    }`,
                    borderRadius: 8,
                    padding: '3px 7px',
                    width: item.isVip ? 104 : 94,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    boxShadow: item.isVip
                      ? '0 4px 16px rgba(250,204,21,0.35)'
                      : '0 4px 12px rgba(0,0,0,0.45)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: '"Space Grotesk", sans-serif',
                      letterSpacing: '0.04em',
                      color: item.isVip ? '#FACC15' : meta.color,
                    }}
                  >
                    <span>{item.isVip ? `★ ${meta.text}` : meta.text}</span>
                    <span>{Math.round(item.progress * 100)}%</span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 4,
                      borderRadius: 99,
                      background: 'rgba(255,255,255,0.14)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round(item.progress * 100)}%`,
                        height: '100%',
                        background: item.isVip ? '#FACC15' : meta.color,
                        transition: 'width 0.14s linear',
                      }}
                    />
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
