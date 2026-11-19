import { Html } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { COMPETITOR_LAYOUT, PLAYER_LAYOUT } from '../../config/worldLayout';
import { gameSimulation } from '../../engine/simulation';
import type { WashStage } from '../../types/game';

interface ActiveBayInfo {
  id: string;
  x: number;
  z: number;
  progress: number;
  stage: WashStage;
  isPlayer: boolean;
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
            });
          }
        }
      }
      setActiveCars(list);
    }, 180);
    return () => window.clearInterval(id);
  }, []);

  return (
    <group>
      {activeCars.map((item) => {
        const meta = STAGE_SHORT[item.stage];
        const puddleScale = 0.5 + Math.min(1, item.progress * 1.4) * 0.55;
        return (
          <group key={item.id}>
            {/* Glossy Dynamic Wet Floor Puddle under active wash bay */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[item.x, 0.115, item.z]}
              scale={[puddleScale, puddleScale, 1]}
            >
              <circleGeometry args={[2.35, 20]} />
              <meshStandardMaterial
                color={item.stage === 'foam' || item.stage === 'scrub' ? '#CFE9FA' : '#38BDF8'}
                roughness={0.08}
                metalness={0.55}
                transparent
                opacity={0.34}
                depthWrite={false}
              />
            </mesh>

            {/* Compact Overhead Wash Stage Indicator */}
            <Html
              position={[item.x, 2.95, item.z]}
              center
              distanceFactor={26}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div
                style={{
                  background: 'rgba(11, 15, 26, 0.86)',
                  border: `1px solid ${item.isPlayer ? 'rgba(0,212,255,0.45)' : 'rgba(255,77,79,0.45)'}`,
                  borderRadius: 7,
                  padding: '3px 7px',
                  width: 92,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
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
                    letterSpacing: '0.05em',
                    color: meta.color,
                  }}
                >
                  <span>{meta.text}</span>
                  <span>{Math.round(item.progress * 100)}%</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 4,
                    borderRadius: 99,
                    background: 'rgba(255,255,255,0.12)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round(item.progress * 100)}%`,
                      height: '100%',
                      background: meta.color,
                      transition: 'width 0.16s linear',
                    }}
                  />
                </div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
