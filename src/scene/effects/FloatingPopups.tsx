import { Html } from '@react-three/drei';
import { useEffect, useState } from 'react';
import { gameSimulation } from '../../engine/simulation';
import { useGameStore } from '../../store/useGameStore';
import type { FloatingPopup } from '../../types/game';

export function FloatingPopups() {
  const showPopups = useGameStore((s) => s.settings.showPopups);
  const started = useGameStore((s) => s.started);
  const [items, setItems] = useState<FloatingPopup[]>([]);

  useEffect(() => {
    if (!showPopups || !started) {
      setItems([]);
      return;
    }
    const timer = window.setInterval(() => {
      setItems([...gameSimulation.popups]);
    }, 100);
    return () => window.clearInterval(timer);
  }, [showPopups, started]);

  if (!showPopups || !started || items.length === 0) return null;

  const now = performance.now();

  return (
    <group>
      {items.map((pop) => {
        const progress = Math.min(1, Math.max(0, (now - pop.createdAt) / pop.duration));
        const liftY = pop.y + progress * 2.0;
        const opacity = progress < 0.72 ? 1 : 1 - (progress - 0.72) / 0.28;

        return (
          <Html
            key={pop.id}
            position={[pop.x, liftY, pop.z]}
            center
            distanceFactor={26}
            zIndexRange={[1, 4]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div
              style={{
                opacity,
                transform: `scale(${0.92 + (1 - progress) * 0.18})`,
                color: pop.color,
                background: 'rgba(10, 15, 28, 0.92)',
                border: `1.5px solid ${pop.color}`,
                borderRadius: '10px',
                padding: '3px 10px',
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: '14px',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                boxShadow: `0 6px 18px rgba(0,0,0,0.45), 0 0 12px ${pop.color}33`,
              }}
            >
              {pop.text}
            </div>
          </Html>
        );
      })}
    </group>
  );
}
